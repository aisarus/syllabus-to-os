import {
  AlertTriangle,
  CloudUpload,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatFileSize } from "@/lib/document-ingestion";
import { formatMediaTime, putLongMediaTranscript, type LongMediaManifest, type LongMediaTranscriptDraft } from "@/lib/long-media";
import {
  createLongMediaTranscriptionJob,
  mergeProviderRangeIntoTranscript,
  summarizeTranscriptionJob,
  validateGeminiTranscriptionEligibility,
  type LongMediaTranscriptionJob,
  type LongMediaTranscriptionRange,
} from "@/lib/long-media-transcription";
import {
  deleteProviderTranscriptionFile,
  getTranscriptionProviderStatus,
  transcribeStoredLectureRange,
  uploadStoredLectureToProvider,
  type TranscriptionProviderStatus,
} from "@/lib/long-media-transcription-client";
import {
  getLongMediaTranscriptionJob,
  longMediaTranscriptionStore,
  useLongMediaTranscriptionData,
} from "@/lib/long-media-transcription-store";
import { putLongMediaTranscript as saveLongMediaTranscript } from "@/lib/long-media-store";
import type { Material } from "@/lib/store";

export function LongMediaTranscriptionPanel({
  material,
  manifest,
  transcript,
  onTranscriptChange,
  isRu,
}: {
  material: Material;
  manifest: LongMediaManifest;
  transcript: LongMediaTranscriptDraft | undefined;
  onTranscriptChange: (draft: LongMediaTranscriptDraft) => void;
  isRu: boolean;
}) {
  const data = useLongMediaTranscriptionData();
  const job = data.jobs.find(
    (item) => item.materialId === material.id && item.sourceUploadId === manifest.uploadId,
  );
  const abortRef = useRef<AbortController | null>(null);
  const [provider, setProvider] = useState<TranscriptionProviderStatus | null>(null);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [consented, setConsented] = useState(false);
  const [languageHint, setLanguageHint] = useState(material.sourceLanguage || "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void getTranscriptionProviderStatus(controller.signal)
      .then((status) => {
        setProvider(status);
        setProviderError(null);
      })
      .catch((error) => setProviderError(error instanceof Error ? error.message : String(error)));
    return () => controller.abort();
  }, []);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  const eligibility = validateGeminiTranscriptionEligibility(manifest);
  const summary = job ? summarizeTranscriptionJob(job) : undefined;
  const canResume = Boolean(
    job &&
      (job.status === "paused" || job.status === "failed") &&
      job.ranges.some((range) => range.status !== "completed"),
  );
  const rangeStatus = useMemo(
    () => new Map(job?.ranges.map((range) => [range.id, range]) ?? []),
    [job?.ranges],
  );

  const start = async (resume: boolean) => {
    if (!provider?.configured) {
      toast.error(
        isRu
          ? "На этом deployment не настроен GEMINI_API_KEY."
          : "GEMINI_API_KEY is not configured on this deployment.",
      );
      return;
    }
    if (!eligibility.ok) {
      toast.error(eligibility.message);
      return;
    }
    if (!consented) {
      toast.error(
        isRu
          ? "Сначала явно подтверди отправку записи в Google Gemini."
          : "Explicitly consent to sending the recording to Google Gemini first.",
      );
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    let workingJob = resume && job ? job : createLongMediaTranscriptionJob(manifest);
    if (!resume || !job) longMediaTranscriptionStore.replaceJob(workingJob);

    try {
      workingJob = await ensureProviderFile(workingJob, controller.signal);
      workingJob = await processPendingRanges(workingJob, controller.signal);
      longMediaTranscriptionStore.patchJob(material.id, {
        status: "completed",
        completedAt: Date.now(),
        error: undefined,
      });
      if (workingJob.providerFileName) {
        await deleteProviderTranscriptionFile(workingJob.providerFileName).catch(() => undefined);
        longMediaTranscriptionStore.patchJob(material.id, {
          providerFileName: undefined,
          providerFileUri: undefined,
        });
      }
      toast.success(
        isRu
          ? "Черновик расшифровки готов. Проверь каждый блок перед подтверждением."
          : "Transcript draft is ready. Review every block before approval.",
      );
    } catch (error) {
      const aborted = error instanceof DOMException && error.name === "AbortError";
      longMediaTranscriptionStore.patchJob(material.id, {
        status: aborted ? "paused" : "failed",
        error: aborted ? undefined : error instanceof Error ? error.message : String(error),
      });
      if (aborted) {
        toast.info(
          isRu
            ? "Работа остановлена. Готовые диапазоны и черновик сохранены."
            : "Work paused. Completed ranges and draft text are preserved.",
        );
      } else {
        toast.error(error instanceof Error ? error.message : String(error));
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  };

  const ensureProviderFile = async (
    current: LongMediaTranscriptionJob,
    signal: AbortSignal,
  ): Promise<LongMediaTranscriptionJob> => {
    if (current.providerFileName && current.providerFileUri) {
      const patched = longMediaTranscriptionStore.patchJob(material.id, {
        status: "processing",
        consentedAt: current.consentedAt ?? Date.now(),
        error: undefined,
      });
      return patched ?? current;
    }
    longMediaTranscriptionStore.patchJob(material.id, {
      status: "uploading",
      uploadedBytes: 0,
      consentedAt: Date.now(),
      error: undefined,
    });
    const file = await uploadStoredLectureToProvider(manifest, {
      signal,
      onProgress: (progress) =>
        longMediaTranscriptionStore.patchJob(material.id, {
          uploadedBytes: progress.uploadedBytes,
          status: "uploading",
        }),
    });
    const patched = longMediaTranscriptionStore.patchJob(material.id, {
      status: "processing",
      uploadedBytes: manifest.size,
      providerFileName: file.name,
      providerFileUri: file.uri,
      error: undefined,
    });
    if (!patched) throw new Error("Transcription job disappeared after provider upload.");
    return patched;
  };

  const processPendingRanges = async (
    current: LongMediaTranscriptionJob,
    signal: AbortSignal,
  ): Promise<LongMediaTranscriptionJob> => {
    let working = current;
    let workingTranscript = transcript;
    for (const range of working.ranges) {
      if (range.status === "completed") continue;
      if (!working.providerFileName || !working.providerFileUri) {
        throw new Error("Provider file reference is missing; restart the upload.");
      }
      throwIfAborted(signal);
      longMediaTranscriptionStore.patchRange(material.id, range.id, {
        status: "processing",
        attempts: range.attempts + 1,
        error: undefined,
      });
      try {
        const result = await transcribeStoredLectureRange({
          jobId: working.id,
          range,
          providerFileName: working.providerFileName,
          providerFileUri: working.providerFileUri,
          mimeType: manifest.mimeType,
          languageHint: languageHint.trim() || undefined,
          signal,
        });
        workingTranscript = mergeProviderRangeIntoTranscript(
          workingTranscript,
          manifest,
          result,
        );
        workingTranscript = await saveLongMediaTranscript(workingTranscript);
        onTranscriptChange(workingTranscript);
        longMediaTranscriptionStore.patchRange(material.id, range.id, {
          status: "completed",
          segmentCount: result.segments.length + result.missingIntervals.length,
          error: undefined,
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") throw error;
        longMediaTranscriptionStore.patchRange(material.id, range.id, {
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
      working = getLongMediaTranscriptionJob(material.id) ?? working;
    }
    return working;
  };

  const pause = () => abortRef.current?.abort();

  const cancelAndDelete = async () => {
    abortRef.current?.abort();
    setBusy(true);
    try {
      const current = getLongMediaTranscriptionJob(material.id);
      if (current?.providerFileName) {
        await deleteProviderTranscriptionFile(current.providerFileName).catch(() => undefined);
      }
      longMediaTranscriptionStore.patchJob(material.id, {
        status: "cancelled",
        providerFileName: undefined,
        providerFileUri: undefined,
        error: undefined,
      });
      toast.info(
        isRu
          ? "Provider file удалён. Локальная запись и уже полученный черновик сохранены."
          : "Provider file deleted. Local media and existing draft text remain intact.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 md:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-amber-200">
            <ShieldAlert className="h-4 w-4" />
            {isRu ? "Внешняя автоматическая расшифровка" : "External automatic transcription"}
          </div>
          <h3 className="mt-2 font-serif text-xl font-semibold">
            {isRu ? "Google Gemini — только после явного согласия" : "Google Gemini — explicit consent only"}
          </h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {isRu
              ? "При запуске запись будет отправлена в Google Gemini Files API. Google хранит загруженный файл до 48 часов; Lamdan обрабатывает его диапазонами по 10 минут. Ответ попадает только в редактируемый черновик: ни один блок не станет источником без твоего ручного подтверждения."
              : "Starting this sends the recording to Google Gemini Files API. Google retains uploaded files for up to 48 hours; Lamdan processes ten-minute ranges. Output enters an editable draft only and never becomes a source without manual approval."}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-background px-4 py-3 text-xs">
          <strong className="block">{provider?.providerName ?? "Google Gemini Files API"}</strong>
          <span className="mt-1 block text-muted-foreground">{manifest.fileName}</span>
          <span className="text-muted-foreground">{formatFileSize(manifest.size)}</span>
        </div>
      </div>

      {providerError ? (
        <p className="mt-4 text-sm text-red-300">{providerError}</p>
      ) : provider && !provider.configured ? (
        <div className="mt-4 flex gap-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {isRu
            ? "На deployment не настроен GEMINI_API_KEY; внешняя отправка отключена. Локальная запись и ручной импорт работают как раньше."
            : "GEMINI_API_KEY is not configured; external upload is disabled. Local media and manual transcript import still work."}
        </div>
      ) : null}

      {!eligibility.ok ? (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-200">
          {eligibility.message}
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <label className="flex items-start gap-3 rounded-lg border border-border bg-background p-4 text-sm">
          <input
            className="mt-1"
            type="checkbox"
            checked={consented}
            onChange={(event) => setConsented(event.target.checked)}
            disabled={busy}
          />
          <span>
            <strong className="block">
              {isRu ? "Я согласен отправить эту запись в Google Gemini" : "I consent to send this recording to Google Gemini"}
            </strong>
            <span className="mt-1 block text-xs leading-5 text-muted-foreground">
              {isRu
                ? "Согласие относится только к этому запуску и этой версии файла. Локальное хранение, плеер и SHA-проверка ничего не отправляют."
                : "Consent applies only to this run and file version. Local storage, playback and integrity checks upload nothing."}
            </span>
          </span>
        </label>
        <label className="text-xs text-muted-foreground">
          {isRu ? "Подсказка языка" : "Language hint"}
          <Input
            className="mt-1"
            value={languageHint}
            onChange={(event) => setLanguageHint(event.target.value)}
            placeholder={isRu ? "he, ru, en или пусто" : "he, ru, en or blank"}
            disabled={busy}
          />
        </label>
      </div>

      {job ? (
        <div className="mt-4 rounded-lg border border-border bg-background p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span>
              {isRu ? "Статус" : "Status"}: <strong>{job.status}</strong>
            </span>
            <span>
              {summary?.completedRanges ?? 0}/{summary?.totalRanges ?? 0} · {summary?.percent ?? 0}%
            </span>
          </div>
          {job.status === "uploading" ? (
            <div className="mt-3">
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${Math.round((job.uploadedBytes / Math.max(1, job.fileSize)) * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatFileSize(job.uploadedBytes)} / {formatFileSize(job.fileSize)}
              </p>
            </div>
          ) : null}
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {job.ranges.map((range) => (
              <RangeStatus key={range.id} range={rangeStatus.get(range.id) ?? range} isRu={isRu} />
            ))}
          </div>
          {job.error ? <p className="mt-3 text-xs text-red-300">{job.error}</p> : null}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {!busy && !canResume ? (
          <Button
            onClick={() => void start(false)}
            disabled={!provider?.configured || !eligibility.ok || !consented}
          >
            <CloudUpload className="me-1 h-4 w-4" />
            {isRu ? "Отправить и создать черновик" : "Send and create draft"}
          </Button>
        ) : null}
        {!busy && canResume ? (
          <Button onClick={() => void start(true)} disabled={!consented}>
            <RotateCcw className="me-1 h-4 w-4" />
            {isRu ? "Продолжить" : "Resume"}
          </Button>
        ) : null}
        {busy ? (
          <Button variant="outline" onClick={pause}>
            <Pause className="me-1 h-4 w-4" />
            {isRu ? "Остановить после текущего запроса" : "Pause after current request"}
          </Button>
        ) : null}
        {job && job.status !== "cancelled" && job.status !== "completed" ? (
          <Button variant="destructive" onClick={() => void cancelAndDelete()} disabled={busy && !abortRef.current}>
            <Trash2 className="me-1 h-4 w-4" />
            {isRu ? "Отменить и удалить у provider" : "Cancel and delete provider file"}
          </Button>
        ) : null}
        {busy ? <Loader2 className="h-5 w-5 animate-spin self-center" /> : null}
      </div>

      <p className="mt-4 text-xs leading-5 text-muted-foreground">
        {isRu
          ? "Готовая автоматическая расшифровка остаётся draft. Ни статус completed, ни количество обработанных диапазонов не означают, что текст правильный или что материал изучен."
          : "Completed automatic transcription remains a draft. Completion and processed-range counts do not prove accuracy or learning."}
      </p>
    </section>
  );
}

function RangeStatus({
  range,
  isRu,
}: {
  range: LongMediaTranscriptionRange;
  isRu: boolean;
}) {
  const icon =
    range.status === "processing" ? (
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
    ) : range.status === "completed" ? (
      <Play className="h-3.5 w-3.5" />
    ) : (
      <span className="h-2 w-2 rounded-full bg-current" />
    );
  return (
    <div className="rounded-md border border-border px-3 py-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          {icon}
          {formatMediaTime(range.startSeconds)}–{formatMediaTime(range.endSeconds)}
        </span>
        <span>{range.status}</span>
      </div>
      {range.status === "completed" ? (
        <p className="mt-1 text-muted-foreground">
          {range.segmentCount} {isRu ? "блоков" : "blocks"}
        </p>
      ) : null}
      {range.error ? <p className="mt-1 text-red-300">{range.error}</p> : null}
    </div>
  );
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException("Transcription stopped.", "AbortError");
}
