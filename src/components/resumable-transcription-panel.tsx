import {
  AlertTriangle,
  CheckCircle2,
  CloudUpload,
  FileAudio2,
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
  deleteResumableTranscriptionJob,
  getResumableTranscriptionJob,
  putResumableTranscriptionJob,
} from "@/lib/resumable-transcription-store";
import type { Material } from "@/lib/store";

interface ProviderModels {
  plainModel?: string;
  speakerModel?: string;
}

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
  const [manifest, setManifest] = useState<LongMediaManifest>();
  const [providerStatus, setProviderStatus] = useState<AutomaticTranscriptionProviderStatus>();
  const [job, setJob] = useState<ResumableTranscriptionJob>();
  const [rangeFiles, setRangeFiles] = useState<Record<string, File>>({});
  const [language, setLanguage] = useState("auto");
  const [requestSpeakerLabels, setRequestSpeakerLabels] = useState(true);
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyRangeId, setBusyRangeId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setManifest(undefined);
    setProviderStatus(undefined);
    setJob(undefined);
    setRangeFiles({});
    setConsent(false);
    void Promise.all([
      getLongMediaManifest(material.id),
      getAutomaticTranscriptionProviderStatus(),
      getResumableTranscriptionJob(material.id),
    ])
      .then(async ([nextManifest, nextProvider, nextJob]) => {
        if (cancelled) return;
        setManifest(nextManifest);
        setProviderStatus(nextProvider);
        if (nextJob && nextManifest && nextJob.sourceUploadId !== nextManifest.uploadId) {
          await deleteResumableTranscriptionJob(material.id).catch(() => undefined);
          setJob(undefined);
          return;
        }
        if (nextJob) {
          const recovered = recoverInterruptedResumableJob(nextJob);
          const changed = JSON.stringify(recovered) !== JSON.stringify(nextJob);
          const stored = changed ? await putResumableTranscriptionJob(recovered) : nextJob;
          setJob(stored);
        }
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : String(error)))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      abortRef.current?.controller.abort();
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
      const updated = attachResumableRangeFile(job, rangeId, file, providerStatus?.maxBytes);
      const saved = await putResumableTranscriptionJob(updated);
      setJob(saved);
      setRangeFiles((current) => ({ ...current, [rangeId]: file }));
      setConsent(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  const startSelectedRanges = async () => {
    if (!job || !manifest || !providerStatus?.configured || !consent) return;
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
          ? "Выбери хотя бы один provider-ready clip."
          : "Select at least one provider-ready range clip.",
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
              visible
                ? updateResumableRangeProgress(visible, queuedRange.id, fraction)
                : visible,
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

  const cancelCurrentRange = () => {
    abortRef.current?.controller.abort();
  };

  const loadMergedDraft = async () => {
    if (!job || !manifest) return;
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
    await deleteResumableTranscriptionJob(material.id);
    setJob(undefined);
    setRangeFiles({});
    setConsent(false);
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
              ? "Для длинной пары создай очередь 15-минутных диапазонов и выбери отдельный provider-ready clip для каждого нужного диапазона. Каждый clip отправляется отдельно только после согласия; удачные части сохраняются, а ошибки остаются видимыми и повторяются независимо."
              : "For a long lecture, create a queue of 15-minute ranges and select a provider-ready clip for each needed range. Every clip is uploaded separately only after consent; successful ranges persist while failed ranges remain visible and retry independently."}
          </p>
        </div>
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3 text-xs leading-5 text-yellow-100 lg:max-w-sm">
          <AlertTriangle className="mb-2 h-4 w-4" />
          {isRu
            ? "Граница C1: Lamdan пока не извлекает и не перекодирует эти clips из 4-ГБ оригинала автоматически. Времена диапазонов заданы точно, но корректный clip выбираешь ты. Автоматический локальный transcoding — следующий срез."
            : "C1 boundary: Lamdan does not yet extract or transcode these clips from the 4 GB original automatically. Range times are exact, but you select the matching clip. Automatic local transcoding is the next slice."}
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
            <Metric label={isRu ? "Draft-фрагменты" : "Draft segments"} value={mergedSegments.length} />
          </div>

          <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <strong>{isRu ? "Явное согласие на отдельные clips" : "Explicit consent for separate clips"}</strong>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {job.providerDisplayName} · {job.model}. {isRu ? "Будут отправлены только выбранные ниже файлы, не локальный оригинал целиком." : "Only files selected below are sent, never the complete local original."}
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
                      ? `Я вижу провайдера, модель и ${selectedCount} выбранных файлов и разрешаю отправить их по одному.`
                      : `I can see the provider, model and ${selectedCount} selected files and allow them to be uploaded one by one.`}
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
                onChoose={() => requestFileForRange(range.id)}
                onCancel={cancelCurrentRange}
              />
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              onClick={() => void startSelectedRanges()}
              disabled={
                Boolean(busyRangeId) ||
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
              {isRu ? "Запустить выбранные диапазоны" : "Run selected ranges"}
            </Button>
            {busyRangeId ? (
              <Button variant="destructive" onClick={cancelCurrentRange}>
                <PauseCircle className="me-1 h-4 w-4" />
                {isRu ? "Остановить текущий" : "Stop current range"}
              </Button>
            ) : null}
            <Button
              variant="outline"
              onClick={() => void loadMergedDraft()}
              disabled={mergedSegments.length === 0 || Boolean(busyRangeId)}
            >
              <CheckCircle2 className="me-1 h-4 w-4" />
              {isRu ? "Загрузить объединённый draft" : "Load merged draft"}
            </Button>
            <Button variant="ghost" onClick={() => void discardQueue()} disabled={Boolean(busyRangeId)}>
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
                  .map((gap) => `${formatMediaTime(gap.startSeconds)}–${formatMediaTime(gap.endSeconds)}`)
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
  onChoose,
  onCancel,
}: {
  range: ResumableTranscriptionRange;
  file?: File;
  isRu: boolean;
  busy: boolean;
  onChoose: () => void;
  onCancel: () => void;
}) {
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
                ? `${range.selectedFileName} · ${range.selectedFileSize ? formatFileSize(range.selectedFileSize) : "—"} · ${isRu ? "выбери файл снова после reload" : "select the file again after reload"}`
                : isRu
                  ? "Clip ещё не выбран"
                  : "No clip selected"}
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
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="outline" onClick={onChoose} disabled={busy}>
            {range.status === "failed" || range.status === "cancelled" ? (
              <RotateCcw className="me-1 h-3.5 w-3.5" />
            ) : (
              <FileAudio2 className="me-1 h-3.5 w-3.5" />
            )}
            {isRu ? "Выбрать clip" : "Choose clip"}
          </Button>
          {busy ? (
            <Button size="sm" variant="destructive" onClick={onCancel}>
              {isRu ? "Отмена" : "Cancel"}
            </Button>
          ) : null}
        </div>
      </div>
      {busy ? (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${Math.round(range.uploadProgress * 100)}%` }}
          />
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
