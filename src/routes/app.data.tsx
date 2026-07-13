import { createFileRoute } from "@tanstack/react-router";
import { Download, FileImage, ShieldAlert, Trash2, Upload } from "lucide-react";
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

export const Route = createFileRoute("/app/data")({
  component: DataPage,
});

function DataPage() {
  const { t, lang } = useApp();
  const isRu = lang === "ru";
  const data = useData();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [visualStats, setVisualStats] = useState<VisualSourceStorageStats | null>(null);

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
            ? "Резервная копия текстовых данных и честное управление локальными фото."
            : "Text-data backup and honest management of browser-local images."
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
                ? "Обычный JSON-экспорт включает курсы, тексты, применённый OCR и связи, но пока не включает исходные изображения, обработанные preview и отдельные OCR-черновики из IndexedDB. Не очищай браузер, если оригиналы не сохранены где-то ещё."
                : "The JSON export includes courses, text, applied OCR and relationships, but does not yet include original images, processed previews or separate OCR drafts stored in IndexedDB. Do not clear browser data unless the originals exist elsewhere."}
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
          <h2 className="font-semibold mb-2">{t.export}</h2>
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
          <h2 className="font-semibold mb-2">{t.import}</h2>
          <p className="text-sm text-muted-foreground mb-4">
            {isRu
              ? "Восстанавливает JSON-копию. Текущие исходные фото, обработанные preview и отдельные OCR-черновики будут удалены после подтверждения."
              : "Restores a JSON backup. Current source images, processed previews and separate OCR drafts are removed after confirmation."}
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) doImport(file);
              event.target.value = "";
            }}
          />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4 me-1" />
            {t.importFile}
          </Button>
          {error && <p className="text-xs text-destructive mt-2 break-words">{error}</p>}
        </section>

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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
