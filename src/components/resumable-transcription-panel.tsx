import {
  AlertTriangle,
  CheckCircle2,
  CloudUpload,
  Cpu,
  FileAudio2,
  HardDrive,
  Loader2,
  PauseCircle,
  RotateCcw,
  Scissors,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/app-context";
import {
  getAutomaticTranscriptionProviderStatus,
  requestAutomaticTranscription,
  validateAutomaticTranscriptionFile,
  type AutomaticTranscriptionProviderStatus,
} from "@/lib/automatic-transcription";
import { formatFileSize } from "@/lib/document-ingestion";
import {
  estimateLocalRangeExtraction,
  extractLongMediaRangeLocally,
  getLocalRangeExtractionCapability,
} from "@/lib/local-range-extraction";
import { formatMediaTime, type LongMediaManifest } from "@/lib/long-media";
import {
  getLongMediaManifest,
  getLongMediaTranscript,
  putLongMediaTranscript,
} from "@/lib/long-media-store";
import {
  attachResumableRangeFile,
  beginResumableRangeAttempt,
  buildTranscriptDraftFromResumableJob,
  cancelResumableRangeAttempt,
  completeResumableRangeAttempt,
  createResumableTranscriptionJob,
  getResumableTranscriptionGaps,
  markResumableDraftLoaded,
  mergeResumableTranscriptionSegments,
  recoverInterruptedResumableJob,
  updateResumableRangeProgress,
  type ResumableTranscriptionJob,
  type ResumableTranscriptionRange,
} from "@/lib/resumable-transcription";
import {
  deleteResumableRangeClip,
  deleteResumableTranscriptionJob,
  getResumableTranscriptionJob,
  listResumableRangeClips,
  putResumableRangeClip,
  putResumableTranscriptionJob,
  resumableRangeClipToFile,
} from "@/lib/resumable-transcription-store";
import type { Material } from "@/lib/store";

interface ProviderModels {
  plainModel?: string;
  speakerModel?: string;
}

const LOCAL_EXTRACTION_REASON_RU = {
  browser_only: "Локальная нарезка доступна только в браузере.",
  media_recorder_unavailable: "Этот браузер не поддерживает MediaRecorder для локальной нарезки.",
  web_audio_unavailable: "Этот браузер не поддерживает Web Audio для локальной нарезки.",
  opus_unavailable: "Этот браузер не поддерживает подходящий Opus-аудиоконтейнер.",
} as const;

export function ResumableTranscriptionPanel({
  material,
  onDraftApplied,
}: {
  material: Material;
  onDraftApplied?: () => void;
}) {
  const { lang } = useApp();
  const isRu = lang === "ru";
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingRangeIdRef = useRef<string | null>(null);
  const abortRef = useRef<{ rangeId: string; controller: AbortController } | null>(null);
  const extractionAbortRef = useRef<{
    rangeId: string;
    controller: AbortController;
  } | null>(null);
  const [manifest, setManifest] = useState<LongMediaManifest>();
  const [providerStatus, setProviderStatus] = useState<AutomaticTranscriptionProviderStatus>();
  const [job, setJob] = useState<ResumableTranscriptionJob>();
  const [rangeFiles, setRangeFiles] = useState<Record<string, File>>({});
  const [language, setLanguage] = useState("auto");
  const [requestSpeakerLabels, setRequestSpeakerLabels] = useState(true);
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyRangeId, setBusyRangeId] = useState<string | null>(null);
  const [extractingRangeId, setExtractingRangeId] = useState<string | null>(null);
  const [extractionProgress, setExtractionProgress] = useState<Record<string, number>>({});

  const extractionCapability = useMemo(() => getLocalRangeExtractionCapability(), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setManifest(undefined);
    setProviderStatus(undefined);
    setJob(undefined);
    setRangeFiles({});
    setConsent(false);
    setExtractionProgress({});
    void Promise.all([
      getLongMediaManifest(material.id),
      getAutomaticTranscriptionProviderStatus(),
      getResumableTranscriptionJob(material.id),
      listResumableRangeClips(material.id),
    ])
      .then(async ([nextManifest, nextProvider, nextJob, storedClips]) => {
        if (cancelled) return;
        setManifest(nextManifest);
        setProviderStatus(nextProvider);
        if (nextJob && nextManifest && nextJob.sourceUploadId !== nextManifest.uploadId) {
          await deleteResumableTranscriptionJob(material.id).catch(() => undefined);
          setJob(undefined);
          return;
        }
        if (!nextJob) return;

        let recovered = recoverInterruptedResumableJob(nextJob);
        const restoredFiles: Record<string, File> = {};
        if (nextManifest) {
          for (const clip of storedClips) {
            if (clip.sourceUploadId !== nextManifest.uploadId) continue;
            const range = recovered.ranges.find((item) => item.id === clip.rangeId);
            if (!range) continue;
            const file = resumableRangeClipToFile(clip);
            restoredFiles[clip.rangeId] = file;
            if (range.status !== "review_ready") {
              try {
                recovered = attachResumableRangeFile(
                  recovered,
                  clip.rangeId,
                  file,
                  nextProvider.maxBytes,
                );
              } catch {
                await deleteResumableRangeClip(material.id, clip.rangeId).catch(() => undefined);
                delete restoredFiles[clip.rangeId];
              }
            }
          }
        }
        const changed = JSON.stringify(recovered) !== JSON.stringify(nextJob);
        const stored = changed ? await putResumableTranscriptionJob(recovered) : nextJob;
        setRangeFiles(restoredFiles);
        setJob(stored);
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : String(error)))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      abortRef.current?.controller.abort();
      extractionAbortRef.current?.controller.abort();
    };
  }, [material.id]);

  const models = providerStatus as
    | (AutomaticTranscriptionProviderStatus & ProviderModels)
    | undefined;
  const selectedModel = requestSpeakerLabels
    ? (models?.speakerModel ?? providerStatus?.model)
    : (models?.plainModel ?? providerStatus?.model);
  const mergedSegments = useMemo(
    () => (job ? mergeResumableTranscriptionSegments(job) : []),
    [job],
  );
  const coverageGaps = useMemo(() => (job ? getResumableTranscriptionGaps(job) : []), [job]);
  const completedCount = job?.ranges.filter((range) => range.status === "review_ready").length ?? 0;
  const failedCount =
    job?.ranges.filter((range) => range.status === "failed" || range.status === "cancelled")
      .length ?? 0;
  const selectedCount = job?.ranges.filter((range) => Boolean(rangeFiles[range.id])).length ?? 0;
  const representativeEstimate = useMemo(() => {
    if (!job || !manifest || job.ranges.length === 0) return undefined;
    return estimateLocalRangeExtraction(manifest, job.ranges[0]);
  }, [job, manifest]);
  const anyBusy = Boolean(busyRangeId || extractingRangeId);

  const createQueue = async () => {
    if (!manifest || !providerStatus) return;
    try {
      const created = createResumableTranscriptionJob({
        manifest,
        providerStatus: {
          ...providerStatus,
          model: selectedModel ?? providerStatus.model,
        },
        language: language === "auto" ? undefined : language,
        requestSpeakerLabels,
      });
      const saved = await putResumableTranscriptionJob(created);
      setJob(saved);
      setConsent(false);
      toast.success(
        isRu
          ? `Создано диапазонов: ${saved.ranges.length}`
          : `${saved.ranges.length} resumable ranges created`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  const requestFileForRange = (rangeId: string) => {
    pendingRangeIdRef.current = rangeId;
    inputRef.current?.click();
  };

  const attachFile = async (file: File | undefined) => {
    const rangeId = pendingRangeIdRef.current;
    pendingRangeIdRef.current = null;
    if (!file || !job || !rangeId) return;
    const validation = validateAutomaticTranscriptionFile(file, providerStatus?.maxBytes);
    if (!validation.ok) {
      toast.error(validation.message);
      return;
    }
    try {
      await deleteResumableRangeClip(material.id, rangeId).catch(() => undefined);
      const updated = attachResumableRangeFile(job, rangeId, file, providerStatus?.maxBytes);
      const saved = await putResumableTranscriptionJob(updated);
      setJob(saved);
      setRangeFiles((current) => ({ ...current, [rangeId]: file }));
      setConsent(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  const extractRangeLocally = async (rangeId: string) => {
    if (!job || !manifest || anyBusy) return;
    const range = job.ranges.find((item) => item.id === rangeId);
    if (!range) return;
    const controller = new AbortController();
    extractionAbortRef.current = { rangeId, controller };
    setExtractingRangeId(rangeId);
    setExtractionProgress((current) => ({ ...current, [rangeId]: 0 }));
    try {
      const result = await extractLongMediaRangeLocally({
        manifest,
        range,
        maxOutputBytes: providerStatus?.maxBytes,
        signal: controller.signal,
        onProgress: ({ fraction }) =>
          setExtractionProgress((current) => ({ ...current, [rangeId]: fraction })),
      });
      await putResumableRangeClip({
        materialId: material.id,
        sourceUploadId: manifest.uploadId,
        rangeId,
        startSeconds: result.startSeconds,
        endSeconds: result.endSeconds,
        durationSeconds: result.durationSeconds,
        fileName: result.file.name,
        mimeType: result.mimeType,
        size: result.file.size,
        blob: result.file,
        createdAt: result.createdAt,
        updatedAt: result.createdAt,
      });
      const latestJob = (await getResumableTranscriptionJob(material.id)) ?? job;
      const updated = attachResumableRangeFile(
        latestJob,
        rangeId,
        result.file,
        providerStatus?.maxBytes,
      );
      const saved = await putResumableTranscriptionJob(updated);
      setJob(saved);
      setRangeFiles((current) => ({ ...current, [rangeId]: result.file }));
      setConsent(false);
      toast.success(
        isRu
          ? "Точный локальный audio clip создан и сохранён в браузере"
          : "Exact local audio clip created and stored in the browser",
      );
    } catch (error) {
      if (controller.signal.aborted) {
        toast.message(isRu ? "Локальная нарезка отменена" : "Local extraction cancelled");
      } else {
        toast.error(error instanceof Error ? error.message : String(error));
      }
    } finally {
      extractionAbortRef.current = null;
      setExtractingRangeId(null);
    }
  };

  const startSelectedRanges = async () => {
    if (!job || !manifest || !providerStatus?.configured || !consent || extractingRangeId) return;
    if (job.status === "draft_loaded") {
      toast.error(
        isRu
          ? "Этот результат уже загружен в редактор. Удали очередь и создай новую для повторной обработки."
          : "This result is already loaded. Delete the queue and create a new one before rerunning it.",
      );
      return;
    }
    let current = job;
    const queuedRanges = current.ranges.filter(
      (range) => range.status !== "review_ready" && Boolean(rangeFiles[range.id]),
    );
    if (queuedRanges.length === 0) {
      toast.error(
        isRu
          ? "Выбери или создай хотя бы один provider-ready clip."
          : "Select or create at least one provider-ready range clip.",
      );
      return;
    }

    for (const queuedRange of queuedRanges) {
      const file = rangeFiles[queuedRange.id];
      if (!file) continue;
      const latestManifest = await getLongMediaManifest(material.id);
      if (!latestManifest || latestManifest.uploadId !== current.sourceUploadId) {
        toast.error(
          isRu
            ? "Запись лекции была заменена. Эта очередь больше не может применяться."
            : "The lecture recording changed. This queue can no longer be applied.",
        );
        return;
      }
      const controller = new AbortController();
      abortRef.current = { rangeId: queuedRange.id, controller };
      setBusyRangeId(queuedRange.id);
      try {
        current = await putResumableTranscriptionJob(
          beginResumableRangeAttempt(current, queuedRange.id),
        );
        setJob(current);
        const range = current.ranges.find((item) => item.id === queuedRange.id);
        if (!range) throw new Error("The selected transcription range no longer exists.");
        const response = await requestAutomaticTranscription({
          file,
          materialId: material.id,
          sourceUploadId: current.sourceUploadId,
          durationSeconds: range.endSeconds - range.startSeconds,
          language: current.language,
          requestSpeakerLabels: current.requestSpeakerLabels,
          signal: controller.signal,
          onUploadProgress: (fraction) => {
            setJob((visible) =>
              visible ? updateResumableRangeProgress(visible, queuedRange.id, fraction) : visible,
            );
          },
        });
        if (controller.signal.aborted) {
          current = await putResumableTranscriptionJob(
            cancelResumableRangeAttempt(
              current,
              queuedRange.id,
              isRu ? "Диапазон отменён пользователем." : "Range cancelled by the user.",
            ),
          );
          setJob(current);
          break;
        }
        current = await putResumableTranscriptionJob(
          completeResumableRangeAttempt(current, queuedRange.id, response),
        );
        setJob(current);
      } catch (error) {
        if (controller.signal.aborted) {
          current = await putResumableTranscriptionJob(
            cancelResumableRangeAttempt(
              current,
              queuedRange.id,
              isRu ? "Диапазон отменён пользователем." : "Range cancelled by the user.",
            ),
          );
          setJob(current);
          break;
        }
        const message = error instanceof Error ? error.message : String(error);
        current = await putResumableTranscriptionJob(
          completeResumableRangeAttempt(current, queuedRange.id, {
            ok: false,
            error: message,
          }),
        );
        setJob(current);
        toast.error(message);
      } finally {
        abortRef.current = null;
        setBusyRangeId(null);
      }
    }
  };

  const cancelCurrentRange = () => abortRef.current?.controller.abort();
  const cancelLocalExtraction = () => extractionAbortRef.current?.controller.abort();

  const loadMergedDraft = async () => {
    if (!job || !manifest || job.status === "draft_loaded") return;
    try {
      const existing = await getLongMediaTranscript(material.id);
      const hasApproved = existing?.segments.some((segment) => segment.status === "approved");
      if (
        hasApproved &&
        !window.confirm(
          isRu
            ? "В редакторе есть подтверждённые блоки. Диапазонный результат заменит редактируемый черновик, но применённые source chunks не изменятся до следующего нажатия «Применить». Продолжить?"
            : "The editor contains approved blocks. The range result will replace the editable draft, while applied source chunks stay unchanged until Apply is pressed again. Continue?",
        )
      ) {
        return;
      }
      const draft = buildTranscriptDraftFromResumableJob(job, manifest, existing);
      await putLongMediaTranscript(draft);
      const saved = await putResumableTranscriptionJob(markResumableDraftLoaded(job));
      setJob(saved);
      onDraftApplied?.();
      toast.success(
        isRu
          ? "Объединённый результат загружен как неподтверждённый draft"
          : "Merged range result loaded as an unapproved draft",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  const discardQueue = async () => {
    if (busyRangeId) cancelCurrentRange();
    if (extractingRangeId) cancelLocalExtraction();
    await deleteResumableTranscriptionJob(material.id);
    setJob(undefined);
    setRangeFiles({});
    setConsent(false);
    setExtractionProgress({});
  };

  if (loading) {
    return (
      <section className="mb-5 rounded-xl border border-border bg-surface p-5">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </section>
    );
  }

  if (!manifest) return null;

  return (
    <section className="mb-5 rounded-xl border border-border bg-surface p-4 md:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2">
            <Scissors className="h-5 w-5 text-primary" />
            <h2 className="font-serif text-xl font-semibold">
              {isRu ? "Возобновляемая расшифровка по диапазонам" : "Resumable range transcription"}
            </h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {isRu
              ? "Lamdan может создать точный audio clip для каждого диапазона прямо из локального оригинала, сохранить его в IndexedDB и затем отправить провайдеру только после отдельного согласия."
              : "Lamdan can create an exact audio clip for each range from the local original, keep it in IndexedDB, and upload only that clip after separate consent."}
          </p>
        </div>
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs leading-5 lg:max-w-sm">
          <HardDrive className="mb-2 h-4 w-4 text-primary" />
          {extractionCapability.supported
            ? isRu
              ? "Локальная нарезка идёт в реальном времени, не меняет скорость лекции и не загружает оригинал. Вкладку нужно держать открытой до завершения диапазона."
              : "Local extraction runs in real time, preserves lecture speed, and never uploads the original. Keep this tab open until the range finishes."
            : isRu && extractionCapability.reasonCode
              ? LOCAL_EXTRACTION_REASON_RU[extractionCapability.reasonCode]
              : extractionCapability.reason}
        </div>
      </div>

      {!job ? (
        <div className="mt-5 grid gap-4 rounded-lg border border-border bg-background p-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <label className="text-xs text-muted-foreground">
            {isRu ? "Язык" : "Language"}
            <select
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
            >
              <option value="auto">Auto</option>
              <option value="he">עברית</option>
              <option value="ru">Русский</option>
              <option value="en">English</option>
            </select>
          </label>
          <label className="flex h-10 items-center gap-2 rounded-md border border-input px-3 text-sm">
            <input
              type="checkbox"
              checked={requestSpeakerLabels}
              onChange={(event) => setRequestSpeakerLabels(event.target.checked)}
            />
            {isRu ? "Запросить speaker labels" : "Request speaker labels"}
          </label>
          <Button onClick={() => void createQueue()} disabled={!manifest.durationSeconds}>
            <Scissors className="me-1 h-4 w-4" />
            {isRu ? "Создать очередь" : "Create queue"}
          </Button>
          {!manifest.durationSeconds ? (
            <p className="text-xs text-red-300 md:col-span-3">
              {isRu
                ? "Длительность записи неизвестна. Сначала открой плеер или добавь корректные metadata."
                : "The recording duration is unknown. Load the player or add valid metadata first."}
            </p>
          ) : null}
        </div>
      ) : (
        <>
          <input
            ref={inputRef}
            hidden
            type="file"
            accept="audio/*,video/*,.flac,.mp3,.mp4,.mpeg,.mpga,.m4a,.ogg,.wav,.webm"
            onChange={(event) => {
              void attachFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />

          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            <Metric label={isRu ? "Диапазоны" : "Ranges"} value={job.ranges.length} />
            <Metric label={isRu ? "Готово" : "Complete"} value={completedCount} />
            <Metric label={isRu ? "Ошибки" : "Failed"} value={failedCount} />
            <Metric
              label={isRu ? "Draft-фрагменты" : "Draft segments"}
              value={mergedSegments.length}
            />
          </div>

          {representativeEstimate ? (
            <div className="mt-4 grid gap-3 rounded-lg border border-border bg-background p-4 text-xs sm:grid-cols-3">
              <EstimateItem
                label={isRu ? "Время на один обычный диапазон" : "Typical range time"}
                value={`≈ ${formatMediaTime(representativeEstimate.processingSeconds)}`}
              />
              <EstimateItem
                label={isRu ? "Ожидаемый clip" : "Expected clip"}
                value={`≈ ${formatFileSize(representativeEstimate.expectedOutputBytes)}`}
              />
              <EstimateItem
                label={isRu ? "Рабочая память" : "Working memory"}
                value={`≈ ${formatFileSize(representativeEstimate.workingMemoryBytes)}`}
              />
            </div>
          ) : null}

          <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <strong>
                  {isRu ? "Явное согласие на отправку clips" : "Explicit consent to upload clips"}
                </strong>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {job.providerDisplayName} · {job.model}.{" "}
                  {isRu
                    ? "Будут отправлены только выбранные или локально созданные ниже clips, не оригинал целиком."
                    : "Only clips selected or created below are sent, never the complete original."}
                </p>
                <label className="mt-3 flex items-start gap-2 text-xs">
                  <input
                    className="mt-0.5"
                    type="checkbox"
                    checked={consent}
                    onChange={(event) => setConsent(event.target.checked)}
                  />
                  <span>
                    {isRu
                      ? `Я вижу провайдера, модель и ${selectedCount} подготовленных файлов и разрешаю отправить их по одному.`
                      : `I can see the provider, model and ${selectedCount} prepared files and allow them to be uploaded one by one.`}
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {job.ranges.map((range) => (
              <RangeRow
                key={range.id}
                range={range}
                file={rangeFiles[range.id]}
                isRu={isRu}
                busy={busyRangeId === range.id}
                extracting={extractingRangeId === range.id}
                locked={anyBusy && busyRangeId !== range.id && extractingRangeId !== range.id}
                extractionProgress={extractionProgress[range.id] ?? 0}
                canExtract={extractionCapability.supported}
                estimate={estimateLocalRangeExtraction(manifest, range)}
                onChoose={() => requestFileForRange(range.id)}
                onExtract={() => void extractRangeLocally(range.id)}
                onCancelUpload={cancelCurrentRange}
                onCancelExtraction={cancelLocalExtraction}
              />
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              onClick={() => void startSelectedRanges()}
              disabled={
                anyBusy ||
                !providerStatus?.configured ||
                !consent ||
                selectedCount === 0 ||
                job.status === "draft_loaded"
              }
            >
              {busyRangeId ? (
                <Loader2 className="me-1 h-4 w-4 animate-spin" />
              ) : (
                <CloudUpload className="me-1 h-4 w-4" />
              )}
              {isRu ? "Запустить подготовленные диапазоны" : "Run prepared ranges"}
            </Button>
            {busyRangeId ? (
              <Button variant="destructive" onClick={cancelCurrentRange}>
                <PauseCircle className="me-1 h-4 w-4" />
                {isRu ? "Остановить текущий" : "Stop current range"}
              </Button>
            ) : null}
            {extractingRangeId ? (
              <Button variant="destructive" onClick={cancelLocalExtraction}>
                <PauseCircle className="me-1 h-4 w-4" />
                {isRu ? "Остановить нарезку" : "Stop extraction"}
              </Button>
            ) : null}
            <Button
              variant="outline"
              onClick={() => void loadMergedDraft()}
              disabled={mergedSegments.length === 0 || anyBusy || job.status === "draft_loaded"}
            >
              <CheckCircle2 className="me-1 h-4 w-4" />
              {isRu ? "Загрузить объединённый draft" : "Load merged draft"}
            </Button>
            <Button variant="ghost" onClick={() => void discardQueue()} disabled={anyBusy}>
              <Trash2 className="me-1 h-4 w-4" />
              {isRu ? "Удалить очередь" : "Delete queue"}
            </Button>
          </div>

          {coverageGaps.length > 0 ? (
            <div className="mt-4 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3 text-xs text-yellow-100">
              <strong>{isRu ? "Непокрытые интервалы" : "Uncovered intervals"}</strong>
              <p className="mt-1 leading-5">
                {coverageGaps
                  .slice(0, 8)
                  .map(
                    (gap) =>
                      `${formatMediaTime(gap.startSeconds)}–${formatMediaTime(gap.endSeconds)}`,
                  )
                  .join(" · ")}
              </p>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function RangeRow({
  range,
  file,
  isRu,
  busy,
  extracting,
  locked,
  extractionProgress,
  canExtract,
  estimate,
  onChoose,
  onExtract,
  onCancelUpload,
  onCancelExtraction,
}: {
  range: ResumableTranscriptionRange;
  file?: File;
  isRu: boolean;
  busy: boolean;
  extracting: boolean;
  locked: boolean;
  extractionProgress: number;
  canExtract: boolean;
  estimate: ReturnType<typeof estimateLocalRangeExtraction>;
  onChoose: () => void;
  onExtract: () => void;
  onCancelUpload: () => void;
  onCancelExtraction: () => void;
}) {
  const progress = extracting ? extractionProgress : range.uploadProgress;
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <strong className="font-mono text-sm">
              {formatMediaTime(range.startSeconds)}–{formatMediaTime(range.endSeconds)}
            </strong>
            <StatusBadge status={range.status} isRu={isRu} />
            {range.attempt > 0 ? (
              <span className="text-[11px] text-muted-foreground">
                {isRu ? "попытка" : "attempt"} {range.attempt}
              </span>
            ) : null}
          </div>
          <p className="mt-2 break-words text-xs text-muted-foreground">
            {file
              ? `${file.name} · ${formatFileSize(file.size)}`
              : range.selectedFileName
                ? `${range.selectedFileName} · ${range.selectedFileSize ? formatFileSize(range.selectedFileSize) : "—"} · ${isRu ? "нужен файл снова" : "file must be selected again"}`
                : isRu
                  ? "Clip ещё не подготовлен"
                  : "No clip prepared"}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {isRu ? "Локально" : "Local"}: ≈ {formatMediaTime(estimate.processingSeconds)} ·{" "}
            {formatFileSize(estimate.expectedOutputBytes)}
          </p>
          {range.resultSegments.length > 0 ? (
            <p className="mt-1 text-xs text-emerald-300">
              {isRu ? "Получено фрагментов" : "Segments received"}: {range.resultSegments.length}
            </p>
          ) : null}
          {range.error ? <p className="mt-1 text-xs text-red-300">{range.error}</p> : null}
          {range.warnings.length > 0 ? (
            <p className="mt-1 text-xs text-yellow-200">{range.warnings.join(" · ")}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onChoose}
            disabled={busy || extracting || locked}
          >
            {range.status === "failed" || range.status === "cancelled" ? (
              <RotateCcw className="me-1 h-3.5 w-3.5" />
            ) : (
              <FileAudio2 className="me-1 h-3.5 w-3.5" />
            )}
            {isRu ? "Выбрать clip" : "Choose clip"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onExtract}
            disabled={
              !canExtract || busy || extracting || locked || range.status === "review_ready"
            }
          >
            <Cpu className="me-1 h-3.5 w-3.5" />
            {isRu ? "Создать локально" : "Create locally"}
          </Button>
          {busy ? (
            <Button size="sm" variant="destructive" onClick={onCancelUpload}>
              {isRu ? "Отмена" : "Cancel"}
            </Button>
          ) : null}
          {extracting ? (
            <Button size="sm" variant="destructive" onClick={onCancelExtraction}>
              {isRu ? "Отмена" : "Cancel"}
            </Button>
          ) : null}
        </div>
      </div>
      {busy || extracting ? (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
            <span>
              {extracting
                ? isRu
                  ? "Локальная нарезка"
                  : "Local extraction"
                : isRu
                  ? "Загрузка"
                  : "Upload"}
            </span>
            <span>{Math.round(progress * 100)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3 text-center">
      <strong className="block font-mono text-lg">{value}</strong>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  );
}

function EstimateItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block text-muted-foreground">{label}</span>
      <strong className="mt-1 block font-mono text-sm">{value}</strong>
    </div>
  );
}

function StatusBadge({
  status,
  isRu,
}: {
  status: ResumableTranscriptionRange["status"];
  isRu: boolean;
}) {
  const labels: Record<ResumableTranscriptionRange["status"], [string, string]> = {
    needs_file: ["нужен файл", "needs file"],
    ready: ["готов", "ready"],
    uploading: ["загрузка", "uploading"],
    processing: ["обработка", "processing"],
    review_ready: ["результат готов", "result ready"],
    cancelled: ["отменён", "cancelled"],
    failed: ["ошибка", "failed"],
  };
  const positive = status === "review_ready";
  const negative = status === "failed" || status === "cancelled";
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] ${
        positive
          ? "border-emerald-500/40 text-emerald-300"
          : negative
            ? "border-red-500/40 text-red-300"
            : "border-border text-muted-foreground"
      }`}
    >
      {labels[status][isRu ? 0 : 1]}
    </span>
  );
}
