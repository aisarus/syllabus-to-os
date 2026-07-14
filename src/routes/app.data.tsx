import { createFileRoute } from "@tanstack/react-router";
import {
  ArchiveRestore,
  Download,
  FileArchive,
  FileImage,
  Loader2,
  ShieldAlert,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/app-context";
import { conceptStore, useConceptEvidenceData } from "@/lib/concept-store";
import {
  emptyQuizAttemptDetailData,
  replaceQuizAttemptDetailData,
  useQuizAttemptDetailData,
} from "@/lib/quiz-attempt-details";
import { exportJSON, importJSON, store, useData } from "@/lib/store";
import {
  clearAllVisualSourceData,
  getVisualSourceStorageStats,
  type VisualSourceStorageStats,
} from "@/lib/visual-source-store";
import {
  applyFullVisualBackup,
  createFullVisualBackup,
  MAX_FULL_WORKSPACE_BACKUP_BYTES,
  prepareFullVisualBackup,
  previewFullVisualBackupImport,
  type FullVisualBackupImportPreview,
  type PreparedFullVisualBackup,
} from "@/lib/workspace-backup";

export const Route = createFileRoute("/app/data")({ component: DataPage });

function DataPage() {
  const { t, lang } = useApp();
  const isRu = lang === "ru";
  const data = useData();
  const concepts = useConceptEvidenceData();
  const attemptDetails = useQuizAttemptDetailData();
  const jsonFileRef = useRef<HTMLInputElement>(null);
  const fullBackupFileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [visualStats, setVisualStats] = useState<VisualSourceStorageStats | null>(null);
  const [preparedFullBackup, setPreparedFullBackup] = useState<PreparedFullVisualBackup | null>(
    null,
  );
  const [fullBackupPreview, setFullBackupPreview] = useState<FullVisualBackupImportPreview | null>(
    null,
  );
  const [fullBackupBusy, setFullBackupBusy] = useState(false);

  const refreshVisualStats = useCallback(async () => {
    try {
      setVisualStats(await getVisualSourceStorageStats());
    } catch {
      setVisualStats(null);
    }
  }, []);

  useEffect(() => {
    void refreshVisualStats();
  }, [refreshVisualStats, data.materials.length]);

  const doExport = () => {
    const blob = new Blob([exportJSON()], { type: "application/json" });
    downloadBlob(blob, `lamdan-${new Date().toISOString().slice(0, 10)}.json`);
    toast.success(
      isRu
        ? "JSON-копия экспортирована; фото, concept graph и история ответов в неё не входят"
        : "JSON backup exported; images, concept graph and answer history are not included",
    );
  };

  const clearCompanionStores = () => {
    conceptStore.reset();
    replaceQuizAttemptDetailData(emptyQuizAttemptDetailData());
  };

  const doImport = (file: File) => {
    setError(null);
    const reader = new FileReader();
    reader.onerror = () => {
      const message = isRu ? "Не удалось прочитать файл" : "Could not read the file";
      setError(message);
      toast.error(message);
    };
    reader.onload = async () => {
      const raw = String(reader.result);
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error(
            isRu ? "Файл не содержит объект Lamdan" : "The file does not contain a Lamdan object",
          );
        }
      } catch (parseError) {
        const message = parseError instanceof Error ? parseError.message : String(parseError);
        setError(message);
        toast.error(t.invalidFile);
        return;
      }

      const confirmed = confirm(
        isRu
          ? "JSON полностью заменит core-данные и удалит фото, OCR, concept graph и детальную историю ответов, потому что JSON их не содержит. Продолжить?"
          : "JSON will replace core data and remove images, OCR, the concept graph and detailed answer history because JSON does not contain them. Continue?",
      );
      if (!confirmed) return;
      const result = importJSON(raw);
      if (!result.ok) {
        setError(result.error);
        toast.error(t.invalidFile);
        return;
      }
      try {
        await clearAllVisualSourceData();
        clearCompanionStores();
        await refreshVisualStats();
        toast.success(t.importSuccess);
      } catch (clearError) {
        const message = clearError instanceof Error ? clearError.message : String(clearError);
        setError(message);
        toast.warning(
          isRu
            ? "Core восстановлен, но дополнительные локальные слои очищены не полностью"
            : "Core data was restored, but companion local layers were not fully cleared",
        );
      }
    };
    reader.readAsText(file);
  };

  const doFullExport = async () => {
    setError(null);
    setFullBackupBusy(true);
    try {
      const result = await createFullVisualBackup();
      downloadBlob(result.blob, `lamdan-workspace-${new Date().toISOString().slice(0, 10)}.zip`);
      toast.success(
        isRu
          ? "Workspace ZIP v2 с фото, OCR, concepts и immutable answers экспортирован"
          : "Workspace ZIP v2 with images, OCR, concepts and immutable answers exported",
      );
      if (result.skippedOrphanMaterialIds.length > 0) {
        toast.warning(
          isRu
            ? `Пропущено orphan visual-записей: ${result.skippedOrphanMaterialIds.length}`
            : `Skipped orphan visual records: ${result.skippedOrphanMaterialIds.length}`,
        );
      }
    } catch (backupError) {
      const message = backupError instanceof Error ? backupError.message : String(backupError);
      setError(message);
      toast.error(isRu ? "Не удалось создать workspace-копию" : "Could not create the workspace backup");
    } finally {
      setFullBackupBusy(false);
    }
  };

  const prepareFullImport = async (file: File) => {
    setError(null);
    setPreparedFullBackup(null);
    setFullBackupPreview(null);
    setFullBackupBusy(true);
    try {
      const prepared = await prepareFullVisualBackup(file);
      const preview = await previewFullVisualBackupImport(prepared);
      setPreparedFullBackup(prepared);
      setFullBackupPreview(preview);
      toast.success(
        isRu
          ? "Все payload проверены; выбери режим восстановления"
          : "All payloads verified; choose a restore mode",
      );
    } catch (backupError) {
      const message = backupError instanceof Error ? backupError.message : String(backupError);
      setError(message);
      toast.error(isRu ? "Архив не изменил данные" : "Archive did not change any data");
    } finally {
      setFullBackupBusy(false);
    }
  };

  const applyPreparedFullImport = async (mode: "replace" | "merge") => {
    if (!preparedFullBackup) return;
    if (
      mode === "replace" &&
      !confirm(
        isRu
          ? "Полностью заменить core, фото, OCR, concept graph и детальную историю ответов данными из проверенного ZIP?"
          : "Replace core data, images, OCR, concept graph and detailed answer history with this verified ZIP?",
      )
    ) {
      return;
    }
    setError(null);
    setFullBackupBusy(true);
    try {
      const result = await applyFullVisualBackup(preparedFullBackup, mode);
      setPreparedFullBackup(null);
      setFullBackupPreview(null);
      await refreshVisualStats();
      toast.success(
        isRu
          ? mode === "replace"
            ? "Workspace-копия восстановлена"
            : "Workspace-копия безопасно объединена"
          : mode === "replace"
            ? "Workspace backup restored"
            : "Workspace backup merged safely",
      );
      if (result.warnings.length || result.conflicts.length) {
        toast.warning(
          isRu
            ? `Восстановление завершено с замечаниями: ${result.warnings.length + result.conflicts.length}`
            : `Restore completed with notes: ${result.warnings.length + result.conflicts.length}`,
        );
      }
    } catch (backupError) {
      const message = backupError instanceof Error ? backupError.message : String(backupError);
      setError(message);
      toast.error(
        isRu ? "Восстановление отменено и полностью откатано" : "Restore was cancelled and fully rolled back",
      );
    } finally {
      setFullBackupBusy(false);
    }
  };

  const coreCount =
    data.courses.length +
    data.materials.length +
    data.notes.length +
    data.flashcards.length +
    data.quizzes.length;
  const visualCount =
    (visualStats?.imageCount ?? 0) +
    (visualStats?.processedImageCount ?? 0) +
    (visualStats?.ocrDraftCount ?? 0);
  const answerSnapshotCount = attemptDetails.attempts.reduce(
    (sum, attempt) => sum + attempt.answers.length,
    0,
  );
  const companionCount =
    concepts.concepts.length + concepts.evidenceEvents.length + attemptDetails.attempts.length;
  const hasAnyData = coreCount + visualCount + companionCount > 0;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={t.dataTitle}
        subtitle={
          isRu
            ? "Лёгкий core JSON и checksummed Workspace ZIP v2 для полного учебного пространства."
            : "Lightweight core JSON and a checksummed Workspace ZIP v2 for the complete study workspace."
        }
      />

      <div className="mb-4 rounded-lg border border-border bg-surface p-4 text-sm">
        <strong>{isRu ? "Сейчас в библиотеке" : "Current library"}</strong>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4 lg:grid-cols-8">
          <span>{data.courses.length} {isRu ? "курсов" : "courses"}</span>
          <span>{data.materials.length} {isRu ? "материалов" : "materials"}</span>
          <span>{data.notes.length} {isRu ? "конспектов" : "notes"}</span>
          <span>{data.flashcards.length} {isRu ? "карточек" : "cards"}</span>
          <span>{data.quizzes.length} {isRu ? "тестов" : "quizzes"}</span>
          <span>{concepts.concepts.length} {isRu ? "понятий" : "concepts"}</span>
          <span>{concepts.evidenceEvents.length} evidence</span>
          <span>{answerSnapshotCount} {isRu ? "ответов" : "answers"}</span>
        </div>
      </div>

      <section className="mb-4 rounded-lg border border-yellow-500/25 bg-yellow-500/5 p-4">
        <div className="flex items-start gap-3">
          <FileImage className="mt-0.5 h-5 w-5 shrink-0 text-yellow-200" />
          <div>
            <h2 className="text-sm font-semibold text-yellow-100">
              {isRu ? "Полный перенос — только Workspace ZIP" : "Only Workspace ZIP moves everything"}
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {isRu
                ? "JSON содержит только core store. Workspace ZIP v2 содержит checksummed visual ZIP, concept graph, evidence events и immutable question answers."
                : "JSON contains only the core store. Workspace ZIP v2 includes a checksummed visual ZIP, concept graph, evidence events and immutable question answers."}
            </p>
            <p className="mt-2 text-xs text-foreground">
              {visualStats
                ? `${visualStats.imageCount} ${isRu ? "фото" : "images"} · ${visualStats.processedImageCount} preview · ${visualStats.ocrDraftCount} OCR · ${formatBytes(visualStats.totalVisualBytes)}`
                : isRu
                  ? "Не удалось прочитать статистику визуального хранилища"
                  : "Could not read visual storage statistics"}
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section className="rounded-lg border border-border bg-surface p-6">
          <h2 className="mb-2 font-semibold">{isRu ? "Лёгкий core JSON" : "Lightweight core JSON"}</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            {isRu
              ? "Курсы, материалы, применённый текст, конспекты, карточки и тесты. Без фото, concepts и детальных ответов."
              : "Courses, materials, applied text, notes, cards and quizzes. No images, concepts or detailed answers."}
          </p>
          <Button onClick={doExport} disabled={coreCount === 0}>
            <Download className="h-4 w-4 me-1" />
            {t.export}
          </Button>
        </section>

        <section className="rounded-lg border border-border bg-surface p-6">
          <h2 className="mb-2 font-semibold">{isRu ? "Импорт core JSON" : "Import core JSON"}</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            {isRu
              ? "Полная замена core. Дополнительные visual/evidence-слои очищаются после подтверждения."
              : "Complete core replacement. Companion visual/evidence layers are cleared after confirmation."}
          </p>
          <input
            ref={jsonFileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) doImport(file);
              event.target.value = "";
            }}
          />
          <Button variant="outline" onClick={() => jsonFileRef.current?.click()}>
            <Upload className="h-4 w-4 me-1" />
            {t.importFile}
          </Button>
        </section>

        <section className="rounded-lg border border-primary/35 bg-primary/5 p-6 md:col-span-2">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <FileArchive className="h-5 w-5 text-primary" />
                <h2 className="font-semibold">Workspace ZIP v2</h2>
              </div>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                {isRu
                  ? "Core, оригиналы, preview, processing recipes, OCR, concept graph и история ответов. Каждый payload проверяется по отдельному SHA-256 до изменения библиотеки."
                  : "Core data, originals, previews, processing recipes, OCR, concept graph and answer history. Every payload gets a separate SHA-256 verification before mutation."}
              </p>
            </div>
            <Button onClick={() => void doFullExport()} disabled={!hasAnyData || fullBackupBusy}>
              {fullBackupBusy ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <Download className="h-4 w-4 me-1" />}
              {isRu ? "Скачать ZIP" : "Download ZIP"}
            </Button>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-primary/20 pt-5">
            <input
              ref={fullBackupFileRef}
              type="file"
              accept="application/zip,.zip"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void prepareFullImport(file);
                event.target.value = "";
              }}
            />
            <Button variant="outline" onClick={() => fullBackupFileRef.current?.click()} disabled={fullBackupBusy}>
              {fullBackupBusy ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <ArchiveRestore className="h-4 w-4 me-1" />}
              {isRu ? "Проверить ZIP и восстановить" : "Verify ZIP and restore"}
            </Button>
            <span className="text-xs text-muted-foreground">
              {isRu ? "Локальный лимит: " : "Local limit: "}{formatBytes(MAX_FULL_WORKSPACE_BACKUP_BYTES)}
            </span>
          </div>
        </section>

        {preparedFullBackup && fullBackupPreview && (
          <section className="rounded-lg border border-primary/45 bg-surface p-6 md:col-span-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold">
                  {isRu ? "Проверенная копия готова" : "Verified backup is ready"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isRu
                    ? "Ни один store ещё не изменён. Merge сохраняет текущие ID при конфликте; replace заменяет all four layers."
                    : "No store has changed. Merge keeps current IDs on conflict; replace swaps all four layers."}
                </p>
              </div>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                {formatBytes(fullBackupPreview.summary.bytes)}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 lg:grid-cols-8">
              <BackupStat label={isRu ? "Материалы" : "Materials"} value={fullBackupPreview.summary.materials} />
              <BackupStat label={isRu ? "Фото" : "Images"} value={fullBackupPreview.summary.images} />
              <BackupStat label="Preview" value={fullBackupPreview.summary.processedImages} />
              <BackupStat label="OCR" value={fullBackupPreview.summary.ocrDrafts} />
              <BackupStat label={isRu ? "Понятия" : "Concepts"} value={fullBackupPreview.summary.concepts} />
              <BackupStat label="Evidence" value={fullBackupPreview.summary.evidenceEvents} />
              <BackupStat label={isRu ? "Попытки" : "Attempts"} value={fullBackupPreview.summary.detailedAttempts} />
              <BackupStat label={isRu ? "Ответы" : "Answers"} value={fullBackupPreview.summary.answerSnapshots} />
            </div>

            <BackupNotes
              title={isRu ? "Замечания архива" : "Archive notes"}
              notes={fullBackupPreview.warnings}
              emptyLabel={isRu ? "Проверка не нашла замечаний." : "The verification found no notes."}
            />
            <BackupNotes
              title={isRu ? "Конфликты merge" : "Merge conflicts"}
              notes={fullBackupPreview.mergeConflicts}
              emptyLabel={
                isRu
                  ? "Конфликтов не найдено: merge не перезапишет существующие ID."
                  : "No conflicts found: merge will not overwrite existing IDs."
              }
            />

            <div className="mt-5 flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => void applyPreparedFullImport("merge")} disabled={fullBackupBusy}>
                {fullBackupBusy ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : null}
                {isRu ? "Безопасно объединить" : "Merge safely"}
              </Button>
              <Button variant="destructive" onClick={() => void applyPreparedFullImport("replace")} disabled={fullBackupBusy}>
                {isRu ? "Заменить всё" : "Replace everything"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setPreparedFullBackup(null);
                  setFullBackupPreview(null);
                  setError(null);
                }}
                disabled={fullBackupBusy}
              >
                <X className="h-4 w-4 me-1" />
                {isRu ? "Отмена" : "Cancel"}
              </Button>
            </div>
          </section>
        )}

        {error && (
          <p className="break-words rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive md:col-span-2">
            {error}
          </p>
        )}

        <section className="rounded-lg border border-destructive/40 bg-surface p-6 md:col-span-2">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div className="min-w-0 flex-1">
              <h2 className="mb-2 font-semibold">{t.clearAll}</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                {isRu
                  ? "Удаляет core localStorage, visual IndexedDB, concept graph и immutable answer history. Действие необратимо."
                  : "Deletes core localStorage, visual IndexedDB, concept graph and immutable answer history. This cannot be undone."}
              </p>
              <Button
                variant="destructive"
                disabled={!hasAnyData}
                onClick={async () => {
                  const confirmed = confirm(
                    isRu
                      ? "Безвозвратно удалить все четыре локальных слоя Lamdan?"
                      : "Permanently delete all four local Lamdan storage layers?",
                  );
                  if (!confirmed) return;
                  try {
                    await clearAllVisualSourceData();
                    store.reset();
                    clearCompanionStores();
                    setError(null);
                    await refreshVisualStats();
                    toast.success(isRu ? "Все локальные данные удалены" : "All local data was deleted");
                  } catch (clearError) {
                    const message = clearError instanceof Error ? clearError.message : String(clearError);
                    setError(message);
                    toast.error(isRu ? "Не удалось полностью удалить данные" : "Could not fully delete local data");
                  }
                }}
              >
                <Trash2 className="h-4 w-4 me-1" />
                {t.clearAll}
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function BackupStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
      <div className="text-muted-foreground">{label}</div>
      <div className="mt-1 text-base font-semibold text-foreground">{value}</div>
    </div>
  );
}

function BackupNotes({
  title,
  notes,
  emptyLabel,
}: {
  title: string;
  notes: string[];
  emptyLabel: string;
}) {
  const visibleNotes = notes.slice(0, 5);
  return (
    <div className="mt-4 rounded-md border border-border bg-muted/20 p-3 text-xs">
      <h3 className="font-medium text-foreground">
        {title} <span className="text-muted-foreground">({notes.length})</span>
      </h3>
      {notes.length === 0 ? (
        <p className="mt-1 leading-5 text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="mt-2 space-y-1 leading-5 text-muted-foreground">
          {visibleNotes.map((note, index) => (
            <li key={`${note}-${index}`}>• {note}</li>
          ))}
          {notes.length > visibleNotes.length && <li>• +{notes.length - visibleNotes.length}</li>}
        </ul>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
