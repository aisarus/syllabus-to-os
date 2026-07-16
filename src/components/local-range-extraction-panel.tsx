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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/app-context";
import {
  getAutomaticTranscriptionProviderStatus,
  requestAutomaticTranscription,
  type AutomaticTranscriptionProviderStatus,
} from "@/lib/automatic-transcription";
import { formatFileSize } from "@/lib/document-ingestion";
import {
  estimateLocalRangeExtraction,
  extractLocalAudioRange,
  type LocalRangeExtractionProgress,
} from "@/lib/local-range-extraction";
import {
  deleteLocalRangeClip,
  getLocalRangeClipStats,
  listLocalRangeClips,
  localRangeClipToFile,
  putLocalRangeClip,
  type LocalRangeClipRecord,
} from "@/lib/local-range-extraction-store";
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
  markResumableDraftLoaded,
  mergeResumableTranscriptionSegments,
  updateResumableRangeProgress,
  type ResumableTranscriptionJob,
  type ResumableTranscriptionRange,
} from "@/lib/resumable-transcription";
import {
  getResumableTranscriptionJob,
  putResumableTranscriptionJob,
} from "@/lib/resumable-transcription-store";
import type { Material } from "@/lib/store";

const REFRESH_INTERVAL_MS = 1_500;

export function LocalRangeExtractionPanel({
  material,
  onQueueChanged,
  onDraftApplied,
}: {
  material: Material;
  onQueueChanged?: () => void;
  onDraftApplied?: () => void;
}) {
  const { lang } = useApp();
  const isRu = lang === "ru";
  const abortRef = useRef<AbortController | null>(null);
  const [manifest, setManifest] = useState<LongMediaManifest>();
  const [job, setJob] = useState<ResumableTranscriptionJob>();
  const [providerStatus, setProviderStatus] = useState<AutomaticTranscriptionProviderStatus>();
  const [clips, setClips] = useState<LocalRangeClipRecord[]>([]);
  const [busyRangeId, setBusyRangeId] = useState<string | null>(null);
  const [progress, setProgress] = useState<LocalRangeExtractionProgress>();
  const [providerConsent, setProviderConsent] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [nextManifest, nextJob, nextClips, nextProvider] = await Promise.all([
      getLongMediaManifest(material.id),
      getResumableTranscriptionJob(material.id),
      listLocalRangeClips(material.id),
      getAutomaticTranscriptionProviderStatus(),
    ]);
    const validClips: LocalRangeClipRecord[] = [];
    for (const clip of nextClips) {
      if (!nextManifest || clip.sourceUploadId !== nextManifest.uploadId) {
        await deleteLocalRangeClip(clip.materialId, clip.rangeId).catch(() => undefined);
        continue;
      }
      validClips.push(clip);
    }
    setManifest(nextManifest);
    setJob(nextJob);
    setClips(validClips);
    setProviderStatus(nextProvider);
  }, [material.id]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void refresh()
      .catch((error) => {
        if (!cancelled) toast.error(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    const interval = window.setInterval(() => {
      void refresh().catch(() => undefined);
    }, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      abortRef.current?.abort();
      window.clearInterval(interval);
    };
  }, [refresh]);

  const clipByRangeId = useMemo(() => new Map(clips.map((clip) => [clip.rangeId, clip])), [clips]);
  const extractedCount = job?.ranges.filter((range) => clipByRangeId.has(range.id)).length ?? 0;
  const mergedSegments = useMemo(
    () => (job ? mergeResumableTranscriptionSegments(job) : []),
    [job],
  );

  const extract = async (range: ResumableTranscriptionRange) => {
    if (!manifest || !job || busyRangeId) return;
    const estimate = estimateLocalRangeExtraction(range.startSeconds, range.endSeconds);
    if (!estimate.supported) {
      toast.error(estimate.reasons.join(" "));
      return;
    }
    const confirmed = window.confirm(
      isRu
        ? `Локальная нарезка займёт примерно ${Math.ceil(estimate.estimatedWallSeconds / 60)} мин в реальном времени и создаст около ${formatFileSize(estimate.estimatedBytes)}. Оригинал не отправляется наружу. Начать?`
        : `Local extraction will take about ${Math.ceil(estimate.estimatedWallSeconds / 60)} real-time minutes and create roughly ${formatFileSize(estimate.estimatedBytes)}. The original is not uploaded. Start?`,
    );
    if (!confirmed) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setBusyRangeId(range.id);
    setProgress({
      phase: "preparing",
      capturedSeconds: 0,
      totalSeconds: estimate.durationSeconds,
      fraction: 0,
    });

    try {
      const result = await extractLocalAudioRange(manifest, range.startSeconds, range.endSeconds, {
        signal: controller.signal,
        onProgress: setProgress,
      });
      const latestManifest = await getLongMediaManifest(material.id);
      if (!latestManifest || latestManifest.uploadId !== manifest.uploadId) {
        throw new Error(
          isRu
            ? "Запись лекции была заменена во время нарезки. Clip не сохранён."
            : "The lecture recording changed during extraction. The clip was not saved.",
        );
      }

      const record = await putLocalRangeClip(material.id, range.id, result);
      const latestJob = await getResumableTranscriptionJob(material.id);
      if (!latestJob || latestJob.sourceUploadId !== manifest.uploadId) {
        await deleteLocalRangeClip(material.id, range.id).catch(() => undefined);
        throw new Error(
          isRu
            ? "Очередь диапазонов была удалена или заменена. Clip не прикреплён."
            : "The range queue was removed or replaced. The clip was not attached.",
        );
      }
      const attached = attachResumableRangeFile(
        latestJob,
        range.id,
        result.file,
        providerStatus?.maxBytes,
      );
      const savedJob = await putResumableTranscriptionJob(attached);
      setJob(savedJob);
      setClips((current) => [record, ...current.filter((clip) => clip.rangeId !== range.id)]);
      setProviderConsent(false);
      onQueueChanged?.();
      toast.success(
        isRu
          ? `Clip готов и прикреплён: ${formatFileSize(record.size)}`
          : `Local clip ready and attached: ${formatFileSize(record.size)}`,
      );
    } catch (error) {
      if (
        controller.signal.aborted ||
        (error instanceof DOMException && error.name === "AbortError")
      ) {
        toast.info(isRu ? "Локальная нарезка отменена." : "Local extraction cancelled.");
      } else {
        toast.error(error instanceof Error ? error.message : String(error));
      }
    } finally {
      abortRef.current = null;
      setBusyRangeId(null);
      setProgress(undefined);
      await refresh().catch(() => undefined);
    }
  };

  const sendExtractedClips = async () => {
    if (!job || !manifest || !providerStatus?.configured || !providerConsent) return;
    if (job.status === "draft_loaded") {
      toast.error(
        isRu
          ? "Этот результат уже загружен в редактор. Создай новую очередь для повторной обработки."
          : "This result is already loaded. Create a new queue before processing again.",
      );
      return;
    }

    let current = job;
    const queuedRanges = current.ranges.filter(
      (range) => range.status !== "review_ready" && clipByRangeId.has(range.id),
    );
    if (queuedRanges.length === 0) {
      toast.error(
        isRu ? "Сначала извлеки хотя бы один clip." : "Extract at least one local clip first.",
      );
      return;
    }

    for (const queuedRange of queuedRanges) {
      const clip = clipByRangeId.get(queuedRange.id);
      if (!clip) continue;
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
      abortRef.current = controller;
      setBusyRangeId(queuedRange.id);
      try {
        current = await putResumableTranscriptionJob(
          beginResumableRangeAttempt(current, queuedRange.id),
        );
        setJob(current);
        const range = current.ranges.find((item) => item.id === queuedRange.id);
        if (!range) throw new Error("The selected transcription range no longer exists.");

        const response = await requestAutomaticTranscription({
          file: localRangeClipToFile(clip),
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

    setProviderConsent(false);
    onQueueChanged?.();
  };

  const loadMergedDraft = async () => {
    if (!job || !manifest || job.status === "draft_loaded") return;
    try {
      const existing = await getLongMediaTranscript(material.id);
      const hasApproved = existing?.segments.some((segment) => segment.status === "approved");
      if (
        hasApproved &&
        !window.confirm(
          isRu
            ? "В редакторе есть подтверждённые блоки. Merged draft заменит редактируемый черновик, но source chunks не изменятся до следующего Apply. Продолжить?"
            : "The editor contains approved blocks. The merged draft replaces the editable transcript, while source chunks stay unchanged until Apply. Continue?",
        )
      ) {
        return;
      }
      const draft = buildTranscriptDraftFromResumableJob(job, manifest, existing);
      await putLongMediaTranscript(draft);
      const saved = await putResumableTranscriptionJob(markResumableDraftLoaded(job));
      setJob(saved);
      onQueueChanged?.();
      onDraftApplied?.();
      toast.success(
        isRu
          ? "Merged draft загружен как неподтверждённый"
          : "Merged draft loaded as unapproved transcript text",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  const removeClip = async (rangeId: string) => {
    await deleteLocalRangeClip(material.id, rangeId);
    setClips((current) => current.filter((clip) => clip.rangeId !== rangeId));
    setProviderConsent(false);
    onQueueChanged?.();
  };

  if (loading) {
    return (
      <section className="mb-5 rounded-xl border border-border bg-surface p-5">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </section>
    );
  }
  if (!manifest || !job) return null;

  return (
    <section className="mb-5 rounded-xl border border-border bg-surface p-4 md:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2">
            <Scissors className="h-5 w-5 text-primary" />
            <h2 className="font-serif text-xl font-semibold">
              {isRu
                ? "Локально извлечь clips из оригинала"
                : "Extract local clips from the original"}
            </h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {isRu
              ? "Lamdan читает только нужные HTTP Range-байты из IndexedDB, seek’ается в точный интервал и записывает audio track в реальном времени. Оригинал не собирается в 4-ГБ Blob и не покидает браузер."
              : "Lamdan reads only required HTTP Range bytes from IndexedDB, seeks to the exact interval and records the audio track in real time. The original is never rebuilt as a 4 GB Blob or sent outside the browser."}
          </p>
        </div>
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3 text-xs leading-5 text-yellow-100 lg:max-w-sm">
          <ShieldCheck className="mb-2 h-4 w-4" />
          {isRu
            ? "Нарезка локальная и cancellable, но идёт с нормальной скоростью: 15 минут аудио ≈ 15 минут работы. Вкладка должна оставаться активной."
            : "Extraction is local and cancellable, but runs at normal speed: 15 minutes of audio takes about 15 minutes. Keep the tab active."}
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {job.ranges.map((range) => {
          const clip = clipByRangeId.get(range.id);
          const estimate = estimateLocalRangeExtraction(range.startSeconds, range.endSeconds);
          const busy = busyRangeId === range.id;
          return (
            <div key={range.id} className="rounded-lg border border-border bg-background p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <strong className="font-mono text-sm">
                    {formatMediaTime(range.startSeconds)}–{formatMediaTime(range.endSeconds)}
                  </strong>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {isRu ? "Время работы" : "Wall time"}: ~
                    {Math.ceil(estimate.estimatedWallSeconds / 60)} min ·{" "}
                    {isRu ? "ожидаемый размер" : "estimated size"}: ~
                    {formatFileSize(estimate.estimatedBytes)}
                  </p>
                  {clip ? (
                    <p className="mt-2 flex items-center gap-2 text-xs text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {clip.fileName} · {formatFileSize(clip.size)}
                    </p>
                  ) : null}
                  {range.error ? <p className="mt-1 text-xs text-red-300">{range.error}</p> : null}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={clip ? "outline" : "default"}
                    onClick={() => void extract(range)}
                    disabled={Boolean(busyRangeId) || job.status === "draft_loaded"}
                  >
                    {busy ? (
                      <Loader2 className="me-1 h-3.5 w-3.5 animate-spin" />
                    ) : clip ? (
                      <RotateCcw className="me-1 h-3.5 w-3.5" />
                    ) : (
                      <FileAudio2 className="me-1 h-3.5 w-3.5" />
                    )}
                    {clip
                      ? isRu
                        ? "Извлечь заново"
                        : "Extract again"
                      : isRu
                        ? "Извлечь локально"
                        : "Extract locally"}
                  </Button>
                  {busy ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => abortRef.current?.abort()}
                    >
                      <PauseCircle className="me-1 h-3.5 w-3.5" />
                      {isRu ? "Отмена" : "Cancel"}
                    </Button>
                  ) : null}
                  {clip && !busy ? (
                    <Button size="icon" variant="ghost" onClick={() => void removeClip(range.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </div>
              {busy && progress ? (
                <div className="mt-3">
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>{progress.phase}</span>
                    <span>{Math.round(progress.fraction * 100)}%</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${Math.round(progress.fraction * 100)}%` }}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-5 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <strong>{isRu ? "Явное согласие перед отправкой" : "Explicit upload consent"}</strong>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {providerStatus?.displayName ?? "OpenAI Audio Transcriptions"} ·{" "}
              {providerStatus?.model ?? job.model}.{" "}
              {isRu
                ? "Будут отправлены только локально извлечённые clips, не оригинал пары."
                : "Only locally extracted clips are uploaded, never the complete lecture recording."}
            </p>
            <label className="mt-3 flex items-start gap-2 text-xs">
              <input
                className="mt-0.5"
                type="checkbox"
                checked={providerConsent}
                onChange={(event) => setProviderConsent(event.target.checked)}
              />
              <span>
                {isRu
                  ? `Я вижу провайдера, модель и ${extractedCount} извлечённых clips и разрешаю отправить их по одному.`
                  : `I can see the provider, model and ${extractedCount} extracted clips and allow them to be uploaded one by one.`}
              </span>
            </label>
          </div>
        </div>
      </div>

      {!providerStatus?.configured ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-yellow-200">
          <AlertTriangle className="h-4 w-4" />
          {providerStatus?.error ??
            (isRu
              ? "Провайдер расшифровки не настроен."
              : "The transcription provider is not configured.")}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          onClick={() => void sendExtractedClips()}
          disabled={
            Boolean(busyRangeId) ||
            !providerStatus?.configured ||
            !providerConsent ||
            extractedCount === 0 ||
            job.status === "draft_loaded"
          }
        >
          {busyRangeId ? (
            <Loader2 className="me-1 h-4 w-4 animate-spin" />
          ) : (
            <CloudUpload className="me-1 h-4 w-4" />
          )}
          {isRu ? "Отправить извлечённые clips" : "Send extracted clips"}
        </Button>
        <Button
          variant="outline"
          onClick={() => void loadMergedDraft()}
          disabled={
            mergedSegments.length === 0 || Boolean(busyRangeId) || job.status === "draft_loaded"
          }
        >
          <CheckCircle2 className="me-1 h-4 w-4" />
          {isRu ? "Загрузить merged draft" : "Load merged draft"}
        </Button>
      </div>
    </section>
  );
}

export async function getLocalExtractionSummary(): Promise<string> {
  const stats = await getLocalRangeClipStats();
  return `${stats.clipCount}:${stats.totalBytes}`;
}
