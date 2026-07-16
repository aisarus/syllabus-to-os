import {
  AlertTriangle,
  CheckCircle2,
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
import { formatFileSize } from "@/lib/document-ingestion";
import {
  estimateLocalRangeExtraction,
  extractLocalAudioRange,
  type LocalRangeExtractionProgress,
} from "@/lib/local-range-extraction";
import { dispatchLocalRangeClipReady } from "@/lib/local-range-extraction-events";
import {
  deleteLocalRangeClip,
  getLocalRangeClipStats,
  listLocalRangeClips,
  localRangeClipToFile,
  putLocalRangeClip,
  type LocalRangeClipRecord,
} from "@/lib/local-range-extraction-store";
import { formatMediaTime, type LongMediaManifest } from "@/lib/long-media";
import { getLongMediaManifest } from "@/lib/long-media-store";
import { inspectLongMediaStreamingCapability } from "@/lib/long-media-streaming";
import type {
  ResumableTranscriptionJob,
  ResumableTranscriptionRange,
} from "@/lib/resumable-transcription";
import { getResumableTranscriptionJob } from "@/lib/resumable-transcription-store";
import type { Material } from "@/lib/store";

const REFRESH_INTERVAL_MS = 1_500;

export function LocalRangeExtractionPanel({ material }: { material: Material }) {
  const { lang } = useApp();
  const isRu = lang === "ru";
  const abortRef = useRef<AbortController | null>(null);
  const dispatchedRef = useRef(new Map<string, number>());
  const [manifest, setManifest] = useState<LongMediaManifest>();
  const [job, setJob] = useState<ResumableTranscriptionJob>();
  const [clips, setClips] = useState<LocalRangeClipRecord[]>([]);
  const [busyRangeId, setBusyRangeId] = useState<string | null>(null);
  const [progress, setProgress] = useState<LocalRangeExtractionProgress>();
  const [loading, setLoading] = useState(true);
  const capability = useMemo(() => inspectLongMediaStreamingCapability(), []);

  const refresh = useCallback(async () => {
    const [nextManifest, nextJob, nextClips] = await Promise.all([
      getLongMediaManifest(material.id),
      getResumableTranscriptionJob(material.id),
      listLocalRangeClips(material.id),
    ]);
    const validClips: LocalRangeClipRecord[] = [];
    for (const clip of nextClips) {
      if (!nextManifest || clip.sourceUploadId !== nextManifest.uploadId) {
        await deleteLocalRangeClip(clip.materialId, clip.rangeId).catch(() => undefined);
        continue;
      }
      validClips.push(clip);
      const dispatchKey = `${clip.rangeId}:${clip.updatedAt}`;
      if (dispatchedRef.current.get(clip.rangeId) !== clip.updatedAt) {
        dispatchedRef.current.set(clip.rangeId, clip.updatedAt);
        dispatchLocalRangeClipReady({
          materialId: clip.materialId,
          rangeId: clip.rangeId,
          file: localRangeClipToFile(clip),
          persisted: true,
        });
      }
      if (dispatchKey.length === 0) throw new Error("Unreachable clip dispatch state.");
    }
    setManifest(nextManifest);
    setJob(nextJob);
    setClips(validClips);
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

  const clipByRangeId = useMemo(
    () => new Map(clips.map((clip) => [clip.rangeId, clip])),
    [clips],
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
      const result = await extractLocalAudioRange(
        manifest,
        range.startSeconds,
        range.endSeconds,
        {
          signal: controller.signal,
          onProgress: setProgress,
        },
      );
      const latestManifest = await getLongMediaManifest(material.id);
      if (!latestManifest || latestManifest.uploadId !== manifest.uploadId) {
        throw new Error(
          isRu
            ? "Запись лекции была заменена во время нарезки. Clip не сохранён."
            : "The lecture recording changed during extraction. The clip was not saved.",
        );
      }
      const record = await putLocalRangeClip(material.id, range.id, result);
      setClips((current) => [record, ...current.filter((clip) => clip.rangeId !== range.id)]);
      dispatchedRef.current.set(range.id, record.updatedAt);
      dispatchLocalRangeClipReady({
        materialId: material.id,
        rangeId: range.id,
        file: result.file,
        persisted: true,
      });
      toast.success(
        isRu
          ? `Clip готов: ${formatFileSize(record.size)}`
          : `Local clip ready: ${formatFileSize(record.size)}`,
      );
    } catch (error) {
      if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) {
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

  const removeClip = async (rangeId: string) => {
    await deleteLocalRangeClip(material.id, rangeId);
    dispatchedRef.current.delete(rangeId);
    setClips((current) => current.filter((clip) => clip.rangeId !== rangeId));
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
              {isRu ? "Локально извлечь clips из оригинала" : "Extract local clips from the original"}
            </h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {isRu
              ? "Lamdan читает только нужные HTTP Range-байты из IndexedDB, seek’ается в точный интервал и записывает audio track в реальном времени. Оригинал не собирается в 4-ГБ Blob и не покидает браузер."
              : "Lamdan reads only required HTTP Range bytes from IndexedDB, seeks to the exact interval and records the audio track in real time. The original is never rebuilt as a 4 GB Blob or sent outside the browser."}
          </p>
        </div>
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3 text-xs leading-5 text-yellow-100 lg:max-w-sm">
          {capability.supported ? (
            <>
              <ShieldCheck className="mb-2 h-4 w-4" />
              {isRu
                ? "Нарезка локальная и cancellable, но идёт с нормальной скоростью: 15 минут аудио ≈ 15 минут работы. Вкладка должна оставаться активной."
                : "Extraction is local and cancellable, but runs at normal speed: 15 minutes of audio takes about 15 minutes. Keep the tab active."}
            </>
          ) : (
            <>
              <AlertTriangle className="mb-2 h-4 w-4" />
              {capability.reasons.join(" ")}
            </>
          )}
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
                    {Math.ceil(estimate.estimatedWallSeconds / 60)} min · {isRu ? "ожидаемый размер" : "estimated size"}: ~
                    {formatFileSize(estimate.estimatedBytes)}
                  </p>
                  {clip ? (
                    <p className="mt-2 flex items-center gap-2 text-xs text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {clip.fileName} · {formatFileSize(clip.size)}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={clip ? "outline" : "default"}
                    onClick={() => void extract(range)}
                    disabled={!capability.supported || Boolean(busyRangeId) || job.status === "draft_loaded"}
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
                    <Button size="sm" variant="destructive" onClick={() => abortRef.current?.abort()}>
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
    </section>
  );
}

export async function getLocalExtractionSummary(): Promise<string> {
  const stats = await getLocalRangeClipStats();
  return `${stats.clipCount}:${stats.totalBytes}`;
}
