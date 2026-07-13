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
import { exportJSON, importJSON, store, useData } from "@/lib/store";
import {
  clearAllVisualSourceData,
  getVisualSourceStorageStats,
  type VisualSourceStorageStats,
} from "@/lib/visual-source-store";
import {
  applyFullVisualBackup,
  createFullVisualBackup,
  prepareFullVisualBackup,
  previewFullVisualBackupImport,
  type FullVisualBackupImportPreview,
  type PreparedFullVisualBackup,
} from "@/lib/visual-backup";

export const Route = createFileRoute("/app/data")({
  component: DataPage,
});

function DataPage() {
  const { t, lang } = useApp();
  const isRu = lang === "ru";
  const data = useData();
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
    const json = exportJSON();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `lamdan-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success(
      isRu
        ? "JSON-копия экспортирована; исходные фото в неё не входят"
        : "JSON backup exported; original images are not included",
    );
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
          ? "Импорт полностью заменит текстовые данные Lamdan и удалит локальные исходные фото и OCR-черновики, потому что JSON-копия их не содержит. Продолжить?"
          : "Import will replace Lamdan text data and remove local source images and OCR drafts because the JSON backup does not contain them. Continue?",
      );
      if (!confirmed) {
        toast.message(
          isRu ? "Импорт отменён, данные не изменены" : "Import cancelled; data was not changed",
        );
        return;
      }

      const result = importJSON(raw);
      if (result.ok) {
        try {
          await clearAllVisualSourceData();
          await refreshVisualStats();
        } catch (visualError) {
          const message = visualError instanceof Error ? visualError.message : String(visualError);
          setError(message);
          toast.warning(
            isRu
              ? "Текст восстановлен, но локальные фото не удалось полностью очистить"
              : "Text was restored, but local images could not be fully cleared",
          );
          return;
        }
        toast.success(t.importSuccess);
      } else {
        setError(result.error);
        toast.error(t.invalidFile);
      }
    };
    reader.readAsText(file);
  };

  const doFullExport = async () => {
    setError(null);
    setFullBackupBusy(true);
    try {
      const result = await createFullVisualBackup();
      downloadBlob(result.blob, `lamdan-full-${new Date().toISOString().slice(0, 10)}.zip`);
      toast.success(
        isRu
          ? "Полная ZIP-копия с фото и OCR-черновиками экспортирована"
          : "Full ZIP backup with images and OCR drafts exported",
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
      toast.error(isRu ? "Не удалось создать полную копию" : "Could not create the full backup");
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
          ? "Архив проверен; выбери режим восстановления"
          : "Archive verified; choose a restore mode",
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
          ? "Полностью заменить текущие текстовые данные, фотографии, обработанные preview и OCR-черновики данными из проверенного ZIP?"
          : "Replace current text data, source images, processed previews and OCR drafts with this verified ZIP?",
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
            ? "Полная копия восстановлена"
            : "Полная копия безопасно объединена"
          : mode === "replace"
            ? "Full backup restored"
            : "Full backup merged safely",
      );
      if (result.warnings.length > 0 || result.conflicts.length > 0) {
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
        isRu ? "Восстановление отменено и откатано" : "Restore was cancelled and rolled back",
      );
    } finally {
      setFullBackupBusy(false);
    }
  };

  const itemCount =
    data.courses.length +
    data.materials.length +
    data.notes.length +
    data.flashcards.length +
    data.quizzes.length;
  const visualItemCount =
    (visualStats?.imageCount ?? 0) +
    (visualStats?.processedImageCount ?? 0) +
    (visualStats?.ocrDraftCount ?? 0);
  const hasAnyData = itemCount > 0 || visualItemCount > 0;

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title={t.dataTitle}
        subtitle={
          isRu
            ? "Лёгкий JSON и полная ZIP-копия для текстов, фото, preview и OCR-черновиков."
            : "Lightweight JSON and full ZIP backups for text, images, previews and OCR drafts."
        }
      />

      <div className="mb-4 rounded-lg border border-border bg-surface p-4 text-sm">
        <strong>{isRu ? "Сейчас в библиотеке" : "Current library"}</strong>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-5">
          <span>
            {data.courses.length} {isRu ? "курсов" : "courses"}
          </span>
          <span>
            {data.materials.length} {isRu ? "материалов" : "materials"}
          </span>
          <span>
            {data.notes.length} {isRu ? "конспектов" : "notes"}
          </span>
          <span>
            {data.flashcards.length} {isRu ? "карточек" : "cards"}
          </span>
          <span>
            {data.quizzes.length} {isRu ? "тестов" : "quizzes"}
          </span>
        </div>
      </div>

      <section className="mb-4 rounded-lg border border-yellow-500/25 bg-yellow-500/5 p-4">
        <div className="flex items-start gap-3">
          <FileImage className="mt-0.5 h-5 w-5 shrink-0 text-yellow-200" />
          <div>
            <h2 className="text-sm font-semibold text-yellow-100">
              {isRu ? "Фото хранятся отдельно" : "Images are stored separately"}
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {isRu
                ? "Есть два формата: лёгкий JSON для текстовых данных и полный ZIP с исходными фото, обработанными preview и OCR-черновиками из IndexedDB. Для надёжного переноса всего учебного пространства выбирай ZIP."
                : "There are two formats: lightweight JSON for text data and a full ZIP with source images, processed previews and OCR drafts from IndexedDB. Use ZIP when you need to move the complete study workspace."}
            </p>
            <p className="mt-2 text-xs text-foreground">
              {visualStats
                ? isRu
                  ? `${visualStats.imageCount} фото · ${visualStats.processedImageCount} preview · ${visualStats.ocrDraftCount} OCR-черновиков · ${formatBytes(visualStats.totalVisualBytes)}`
                  : `${visualStats.imageCount} images · ${visualStats.processedImageCount} previews · ${visualStats.ocrDraftCount} OCR drafts · ${formatBytes(visualStats.totalVisualBytes)}`
                : isRu
                  ? "Не удалось прочитать статистику локальных фото"
                  : "Could not read local image statistics"}
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="rounded-lg border border-border bg-surface p-6">
          <h2 className="font-semibold mb-2">{isRu ? "Лёгкий JSON" : "Lightweight JSON"}</h2>
          <p className="text-sm text-muted-foreground mb-4">
            {isRu
              ? "Скачивает JSON с курсами, материалами, применённым распознанным текстом, конспектами, карточками, тестами и связями. Исходные фото не входят."
              : "Downloads JSON containing courses, materials, applied recognized text, notes, flashcards, quizzes and relationships. Original images are not included."}
          </p>
          <Button
            onClick={doExport}
            disabled={itemCount === 0}
            title={
              itemCount === 0
                ? isRu
                  ? "Экспортировать текстовые данные пока нечего"
                  : "There is no text data to export yet"
                : undefined
            }
          >
            <Download className="h-4 w-4 me-1" />
            {t.export}
          </Button>
        </section>

        <section className="rounded-lg border border-border bg-surface p-6">
          <h2 className="font-semibold mb-2">
            {isRu ? "Импорт лёгкого JSON" : "Import lightweight JSON"}
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            {isRu
              ? "Восстанавливает JSON-копию. Текущие исходные фото, обработанные preview и отдельные OCR-черновики будут удалены после подтверждения."
              : "Restores a JSON backup. Current source images, processed previews and separate OCR drafts are removed after confirmation."}
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
                <h2 className="font-semibold">{isRu ? "Полная ZIP-копия" : "Full ZIP backup"}</h2>
              </div>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                {isRu
                  ? "Сохраняет и восстанавливает текстовые данные, оригиналы, обработанные preview, рецепты обработки и отдельные OCR-черновики. Каждый файл проверяется по SHA-256 до изменения текущей библиотеки."
                  : "Exports and restores text data, originals, processed previews, preprocessing recipes and standalone OCR drafts. Every file is verified by SHA-256 before the current library can change."}
              </p>
            </div>
            <Button onClick={() => void doFullExport()} disabled={!hasAnyData || fullBackupBusy}>
              {fullBackupBusy ? (
                <Loader2 className="h-4 w-4 animate-spin me-1" />
              ) : (
                <Download className="h-4 w-4 me-1" />
              )}
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
            <Button
              variant="outline"
              onClick={() => fullBackupFileRef.current?.click()}
              disabled={fullBackupBusy}
            >
              {fullBackupBusy ? (
                <Loader2 className="h-4 w-4 animate-spin me-1" />
              ) : (
                <ArchiveRestore className="h-4 w-4 me-1" />
              )}
              {isRu ? "Проверить ZIP и восстановить" : "Verify ZIP and restore"}
            </Button>
            <span className="text-xs text-muted-foreground">
              {isRu ? "Локальный лимит архива: 150 MB" : "Local archive limit: 150 MB"}
            </span>
          </div>
        </section>

        {preparedFullBackup && fullBackupPreview && (
          <section className="rounded-lg border border-primary/45 bg-surface p-6 md:col-span-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold">
                  {isRu
                    ? "Проверенная копия готова к восстановлению"
                    : "Verified backup is ready to restore"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isRu
                    ? "Ни один текущий файл ещё не изменён. Выбери безопасное объединение или полную замену."
                    : "No current file has changed yet. Choose a safe merge or a complete replacement."}
                </p>
              </div>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                {formatBytes(fullBackupPreview.summary.bytes)}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <BackupStat
                label={isRu ? "Материалы" : "Materials"}
                value={fullBackupPreview.summary.materials}
              />
              <BackupStat
                label={isRu ? "Фото" : "Images"}
                value={fullBackupPreview.summary.images}
              />
              <BackupStat
                label={isRu ? "Preview" : "Previews"}
                value={fullBackupPreview.summary.processedImages}
              />
              <BackupStat
                label={isRu ? "OCR-черновики" : "OCR drafts"}
                value={fullBackupPreview.summary.ocrDrafts}
              />
            </div>

            <BackupNotes
              title={isRu ? "Замечания архива" : "Archive notes"}
              notes={fullBackupPreview.warnings}
              emptyLabel={
                isRu ? "Проверка не нашла замечаний." : "The verification found no notes."
              }
            />
            <BackupNotes
              title={isRu ? "Конфликты при безопасном объединении" : "Safe merge conflicts"}
              notes={fullBackupPreview.mergeConflicts}
              emptyLabel={
                isRu
                  ? "Конфликтов не найдено: объединение не перезапишет существующие записи."
                  : "No conflicts found: the merge will not overwrite existing records."
              }
            />

            <div className="mt-5 flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={() => void applyPreparedFullImport("merge")}
                disabled={fullBackupBusy}
              >
                {fullBackupBusy ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : null}
                {isRu ? "Безопасно объединить" : "Merge safely"}
              </Button>
              <Button
                variant="destructive"
                onClick={() => void applyPreparedFullImport("replace")}
                disabled={fullBackupBusy}
              >
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
          <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive break-words md:col-span-2">
            {error}
          </p>
        )}

        <section className="rounded-lg border border-destructive/40 bg-surface p-6 md:col-span-2">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold mb-2">{t.clearAll}</h2>
              <p className="text-sm text-muted-foreground mb-4">
                {isRu
                  ? "Удаляет localStorage, исходные изображения, обработанные preview и OCR-черновики из IndexedDB в этом браузере. Действие необратимо."
                  : "Deletes localStorage, source images, processed previews and OCR drafts from IndexedDB in this browser. This cannot be undone."}
              </p>
              <Button
                variant="destructive"
                disabled={!hasAnyData}
                title={
                  !hasAnyData
                    ? isRu
                      ? "Локальное хранилище уже пустое"
                      : "Local storage is already empty"
                    : undefined
                }
                onClick={async () => {
                  const confirmed = confirm(
                    isRu
                      ? "Безвозвратно удалить все текстовые данные, исходные фото, обработанные preview и OCR-черновики Lamdan в этом браузере?"
                      : "Permanently delete all Lamdan text data, source images, processed previews and OCR drafts in this browser?",
                  );
                  if (!confirmed) return;
                  try {
                    await clearAllVisualSourceData();
                    store.reset();
                    setError(null);
                    await refreshVisualStats();
                    toast.success(
                      isRu
                        ? "Все локальные данные и фото удалены"
                        : "All local data and images were deleted",
                    );
                  } catch (clearError) {
                    const message =
                      clearError instanceof Error ? clearError.message : String(clearError);
                    setError(message);
                    toast.error(
                      isRu
                        ? "Не удалось полностью удалить локальные фото"
                        : "Could not fully delete local images",
                    );
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
  const visibleNotes = notes.slice(0, 4);

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
