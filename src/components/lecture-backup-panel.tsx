import {
  Archive,
  CheckCircle2,
  Download,
  HardDrive,
  Loader2,
  PauseCircle,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/app-context";
import { formatFileSize } from "@/lib/document-ingestion";
import {
  getStreamingLectureBackupCapability,
  prepareLectureBackupPlan,
  saveLectureBackupPlan,
  type LectureBackupPlan,
  type LectureBackupProgress,
} from "@/lib/lecture-backup";
import type { Material } from "@/lib/store";

const UNSUPPORTED_RU = {
  browser_only: "Потоковый экспорт доступен только в браузере.",
  save_picker_unavailable:
    "Этот браузер не поддерживает безопасную потоковую запись на диск. Открой Lamdan в актуальном Chromium-браузере на компьютере.",
} as const;

export function LectureBackupPanel({ material }: { material: Material }) {
  const { lang } = useApp();
  const isRu = lang === "ru";
  const capability = useMemo(() => getStreamingLectureBackupCapability(), []);
  const abortRef = useRef<AbortController | null>(null);
  const [plan, setPlan] = useState<LectureBackupPlan>();
  const [busy, setBusy] = useState<"planning" | "writing" | null>(null);
  const [progress, setProgress] = useState<LectureBackupProgress>();

  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPlan(undefined);
    setBusy(null);
    setProgress(undefined);
  }, [material.id]);

  const prepare = async () => {
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy("planning");
    setPlan(undefined);
    setProgress(undefined);
    try {
      const prepared = await prepareLectureBackupPlan(material.id, {
        signal: controller.signal,
        onProgress: setProgress,
      });
      setPlan(prepared);
      toast.success(
        isRu
          ? "Lecture bundle проверен и готов к потоковой записи"
          : "Lecture bundle verified and ready for streaming export",
      );
    } catch (error) {
      if (controller.signal.aborted) {
        toast.message(isRu ? "Подготовка экспорта отменена" : "Backup preparation cancelled");
      } else {
        toast.error(error instanceof Error ? error.message : String(error));
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setBusy(null);
    }
  };

  const save = async () => {
    if (!plan) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy("writing");
    setProgress(undefined);
    try {
      await saveLectureBackupPlan(plan, {
        signal: controller.signal,
        onProgress: setProgress,
      });
      toast.success(
        isRu
          ? "Полный lecture bundle записан на диск"
          : "Complete lecture bundle saved to disk",
      );
    } catch (error) {
      if (controller.signal.aborted) {
        toast.message(isRu ? "Потоковый экспорт отменён" : "Streaming export cancelled");
      } else {
        toast.error(error instanceof Error ? error.message : String(error));
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setBusy(null);
    }
  };

  const cancel = () => abortRef.current?.abort();
  const percent = progress?.totalBytes
    ? Math.round(Math.min(1, progress.processedBytes / progress.totalBytes) * 100)
    : 0;

  return (
    <section className="mb-5 rounded-xl border border-border bg-surface p-4 md:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2">
            <Archive className="h-5 w-5 text-primary" />
            <h2 className="font-serif text-xl font-semibold">
              {isRu ? "Потоковая копия лекции" : "Streaming lecture backup"}
            </h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {isRu
              ? "Lamdan запишет на диск raw audio/video chunks, редактируемую расшифровку, provider candidate, resumable queue и локальные clips. Файл строится последовательно и не собирает многогигабайтную лекцию целиком в оперативной памяти."
              : "Lamdan writes raw audio/video chunks, the editable transcript, provider candidate, resumable queue and local clips directly to disk. The bundle is built sequentially without assembling the multi-gigabyte lecture in memory."}
          </p>
        </div>
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs leading-5 lg:max-w-sm">
          <ShieldCheck className="mb-2 h-4 w-4 text-primary" />
          {capability.supported
            ? isRu
              ? "Экспорт полностью локальный. Каждый payload получает SHA-256, а запись прерывается, если исходная лекция изменилась."
              : "Export stays local. Every payload receives SHA-256 and writing stops if the source lecture changes."
            : isRu && capability.reason
              ? UNSUPPORTED_RU[capability.reason]
              : capability.reason === "browser_only"
                ? "Streaming export is available only in a browser."
                : "This browser cannot stream a backup directly to disk. Use a current desktop Chromium browser."}
        </div>
      </div>

      {plan ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label={isRu ? "Raw media" : "Raw media"} value={formatFileSize(plan.manifest.rawMediaBytes)} />
          <Metric label={isRu ? "Записей" : "Records"} value={String(plan.manifest.records.length)} />
          <Metric label={isRu ? "Media chunks" : "Media chunks"} value={String(plan.mediaChunkCount)} />
          <Metric label={isRu ? "Локальные clips" : "Local clips"} value={String(plan.localClipCount)} />
        </div>
      ) : null}

      {plan ? (
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
          <Flag enabled={plan.includesTranscriptDraft} label={isRu ? "editable draft" : "editable draft"} />
          <Flag enabled={plan.includesAutomaticCandidate} label="provider candidate" />
          <Flag enabled={plan.includesResumableQueue} label="resumable queue" />
          <span className="rounded-full border border-border px-2 py-1">
            {isRu ? "Ожидаемый файл" : "Estimated file"}: {formatFileSize(plan.estimatedFileBytes)}
          </span>
        </div>
      ) : null}

      {busy && progress ? (
        <div className="mt-4 rounded-lg border border-border bg-background p-3">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span>
              {busy === "planning"
                ? isRu
                  ? "Проверка SHA-256"
                  : "Verifying SHA-256"
                : isRu
                  ? "Потоковая запись"
                  : "Streaming to disk"}
              {progress.currentKind ? ` · ${progress.currentKind}` : ""}
            </span>
            <span className="font-mono">{percent}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {progress.completedRecords}/{progress.totalRecords} · {formatFileSize(progress.processedBytes)}
          </p>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        <Button
          variant={plan ? "outline" : "default"}
          onClick={() => void prepare()}
          disabled={!capability.supported || Boolean(busy)}
        >
          {busy === "planning" ? (
            <Loader2 className="me-1 h-4 w-4 animate-spin" />
          ) : plan ? (
            <CheckCircle2 className="me-1 h-4 w-4" />
          ) : (
            <HardDrive className="me-1 h-4 w-4" />
          )}
          {plan
            ? isRu
              ? "Проверить заново"
              : "Prepare again"
            : isRu
              ? "Подготовить bundle"
              : "Prepare bundle"}
        </Button>
        <Button onClick={() => void save()} disabled={!plan || Boolean(busy)}>
          {busy === "writing" ? (
            <Loader2 className="me-1 h-4 w-4 animate-spin" />
          ) : (
            <Download className="me-1 h-4 w-4" />
          )}
          {isRu ? "Сохранить потоково" : "Stream to disk"}
        </Button>
        {busy ? (
          <Button variant="destructive" onClick={cancel}>
            <PauseCircle className="me-1 h-4 w-4" />
            {isRu ? "Отмена" : "Cancel"}
          </Button>
        ) : null}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3 text-center">
      <strong className="block font-mono text-base">{value}</strong>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  );
}

function Flag({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <span className="rounded-full border border-border px-2 py-1">
      {enabled ? "✓" : "—"} {label}
    </span>
  );
}
