import {
  ArchiveRestore,
  CheckCircle2,
  FileCheck2,
  Loader2,
  PauseCircle,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/app-context";
import { formatFileSize } from "@/lib/document-ingestion";
import {
  prepareLectureRestore,
  restoreLectureBackup,
  type LectureRestorePlan,
  type LectureRestoreProgress,
} from "@/lib/lecture-restore";

export function LectureRestorePanel() {
  const { lang } = useApp();
  const isRu = lang === "ru";
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [plan, setPlan] = useState<LectureRestorePlan>();
  const [busy, setBusy] = useState<"verifying" | "restoring" | null>(null);
  const [progress, setProgress] = useState<LectureRestoreProgress>();
  const [title, setTitle] = useState("");

  const percent = useMemo(() => {
    if (!progress?.totalBytes) return 0;
    return Math.round(Math.min(1, progress.processedBytes / progress.totalBytes) * 100);
  }, [progress]);

  const chooseFile = () => inputRef.current?.click();

  const prepare = async (file: File | undefined) => {
    if (!file) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy("verifying");
    setPlan(undefined);
    setProgress(undefined);
    try {
      const prepared = await prepareLectureRestore(file, {
        signal: controller.signal,
        onProgress: setProgress,
      });
      setPlan(prepared);
      setTitle(prepared.restoredTitle);
      toast.success(
        isRu
          ? "Lecture bundle полностью проверен и готов к staged restore"
          : "Lecture bundle fully verified and ready for staged restore",
      );
    } catch (error) {
      if (controller.signal.aborted) {
        toast.message(isRu ? "Проверка импорта отменена" : "Restore verification cancelled");
      } else {
        toast.error(error instanceof Error ? error.message : String(error));
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setBusy(null);
    }
  };

  const restore = async () => {
    if (!plan) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy("restoring");
    setProgress(undefined);
    try {
      const result = await restoreLectureBackup(
        {
          ...plan,
          restoredTitle: title.trim() || plan.restoredTitle,
        },
        {
          signal: controller.signal,
          onProgress: setProgress,
        },
      );
      toast.success(
        isRu
          ? "Лекция восстановлена как новый независимый материал"
          : "Lecture restored as a new independent material",
      );
      await navigate({
        to: "/app/materials/$materialId",
        params: { materialId: result.materialId },
      });
    } catch (error) {
      if (controller.signal.aborted) {
        toast.message(
          isRu
            ? "Восстановление отменено; staging полностью очищен"
            : "Restore cancelled; staging was fully cleaned",
        );
      } else {
        toast.error(error instanceof Error ? error.message : String(error));
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setBusy(null);
    }
  };

  const cancel = () => abortRef.current?.abort();

  return (
    <section className="mb-4 rounded-lg border border-primary/25 bg-primary/5 p-5">
      <input
        ref={inputRef}
        hidden
        type="file"
        accept=".lamdan-lecture,application/x-lamdan-lecture-backup"
        onChange={(event) => {
          void prepare(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2">
            <ArchiveRestore className="h-5 w-5 text-primary" />
            <h2 className="font-serif text-lg font-semibold">
              {isRu ? "Восстановить streaming lecture bundle" : "Restore streaming lecture bundle"}
            </h2>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {isRu
              ? "Архив сначала полностью проверяется, затем raw chunks пишутся под новыми staging IDs. Новый материал появляется в библиотеке только после успешного EOF, SHA-256 и публикации всех companion records. Существующие лекции не заменяются."
              : "The archive is fully verified first, then raw chunks are written under new staging IDs. The new material appears only after successful EOF, SHA-256 and companion publication. Existing lectures are never replaced."}
          </p>
        </div>
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3 text-xs leading-5 text-emerald-100 lg:max-w-sm">
          <ShieldCheck className="mb-2 h-4 w-4" />
          {isRu
            ? "Ошибка или отмена запускает rollback chunks, manifest, transcript, provider candidate, queue и clips."
            : "Failure or cancellation rolls back chunks, manifest, transcript, provider candidate, queue and clips."}
        </div>
      </div>

      {plan ? (
        <div className="mt-4 rounded-lg border border-border bg-background p-4">
          <div className="flex items-start gap-3">
            <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
            <div className="min-w-0 flex-1">
              <strong className="block truncate text-sm">
                {plan.sourceManifest.sourceFileName}
              </strong>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatFileSize(plan.file.size)} · {plan.mediaChunkCount} media chunks ·{" "}
                {plan.localClipCount} local clips
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                <Flag enabled={plan.includesTranscriptDraft} label="editable draft" />
                <Flag enabled={plan.includesAutomaticCandidate} label="provider candidate" />
                <Flag enabled={plan.includesResumableQueue} label="resumable queue" />
              </div>
              <label className="mt-3 block text-xs text-muted-foreground">
                {isRu ? "Название нового материала" : "New material title"}
                <input
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  disabled={Boolean(busy)}
                />
              </label>
            </div>
          </div>
        </div>
      ) : null}

      {busy && progress ? (
        <div className="mt-4 rounded-lg border border-border bg-background p-3">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span>
              {progress.phase === "verifying"
                ? isRu
                  ? "Проверка архива"
                  : "Verifying archive"
                : progress.phase === "staging"
                  ? isRu
                    ? "Staging локальных записей"
                    : "Staging local records"
                  : progress.phase === "publishing"
                    ? isRu
                      ? "Атомарная публикация"
                      : "Publishing verified restore"
                    : isRu
                      ? "Rollback"
                      : "Rolling back"}
              {progress.currentKind ? ` · ${progress.currentKind}` : ""}
            </span>
            <span className="font-mono">{percent}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {progress.completedRecords}/{progress.totalRecords} ·{" "}
            {formatFileSize(progress.processedBytes)}
          </p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant={plan ? "outline" : "default"}
          onClick={chooseFile}
          disabled={Boolean(busy)}
        >
          {busy === "verifying" ? (
            <Loader2 className="me-1 h-4 w-4 animate-spin" />
          ) : plan ? (
            <CheckCircle2 className="me-1 h-4 w-4" />
          ) : (
            <Upload className="me-1 h-4 w-4" />
          )}
          {plan
            ? isRu
              ? "Выбрать другой bundle"
              : "Choose another bundle"
            : isRu
              ? "Выбрать .lamdan-lecture"
              : "Choose .lamdan-lecture"}
        </Button>
        <Button onClick={() => void restore()} disabled={!plan || Boolean(busy) || !title.trim()}>
          {busy === "restoring" ? (
            <Loader2 className="me-1 h-4 w-4 animate-spin" />
          ) : (
            <ArchiveRestore className="me-1 h-4 w-4" />
          )}
          {isRu ? "Восстановить как новую лекцию" : "Restore as new lecture"}
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

function Flag({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <span className="rounded-full border border-border px-2 py-1">
      {enabled ? "✓" : "—"} {label}
    </span>
  );
}
