import { createFileRoute } from "@tanstack/react-router";
import { Download, ShieldAlert, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/app-context";
import { exportJSON, importJSON, store, useData } from "@/lib/store";

export const Route = createFileRoute("/app/data")({
  component: DataPage,
});

function DataPage() {
  const { t, lang } = useApp();
  const isRu = lang === "ru";
  const data = useData();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const doExport = () => {
    const json = exportJSON();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `lamdan-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success(isRu ? "Резервная копия экспортирована" : "Backup exported");
  };

  const doImport = (file: File) => {
    setError(null);
    const reader = new FileReader();
    reader.onerror = () => {
      const message = isRu ? "Не удалось прочитать файл" : "Could not read the file";
      setError(message);
      toast.error(message);
    };
    reader.onload = () => {
      const raw = String(reader.result);
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error(isRu ? "Файл не содержит объект Lamdan" : "The file does not contain a Lamdan object");
        }
      } catch (parseError) {
        const message = parseError instanceof Error ? parseError.message : String(parseError);
        setError(message);
        toast.error(t.invalidFile);
        return;
      }

      const confirmed = confirm(
        isRu
          ? "Импорт полностью заменит все текущие данные Lamdan в этом браузере. Продолжить? Перед импортом лучше экспортировать резервную копию."
          : "Import will completely replace all current Lamdan data in this browser. Continue? Export a backup first if needed.",
      );
      if (!confirmed) {
        toast.message(isRu ? "Импорт отменён, данные не изменены" : "Import cancelled; data was not changed");
        return;
      }

      const result = importJSON(raw);
      if (result.ok) {
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

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title={t.dataTitle}
        subtitle={
          isRu
            ? "Полная резервная копия локального хранилища и контролируемое восстановление."
            : "Full local-data backup and controlled restoration."
        }
      />

      <div className="mb-4 rounded-lg border border-border bg-surface p-4 text-sm">
        <strong>{isRu ? "Сейчас в библиотеке" : "Current library"}</strong>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-5">
          <span>{data.courses.length} {isRu ? "курсов" : "courses"}</span>
          <span>{data.materials.length} {isRu ? "материалов" : "materials"}</span>
          <span>{data.notes.length} {isRu ? "конспектов" : "notes"}</span>
          <span>{data.flashcards.length} {isRu ? "карточек" : "cards"}</span>
          <span>{data.quizzes.length} {isRu ? "тестов" : "quizzes"}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="rounded-lg border border-border bg-surface p-6">
          <h2 className="font-semibold mb-2">{t.export}</h2>
          <p className="text-sm text-muted-foreground mb-4">
            {isRu
              ? "Скачивает один JSON-файл со всеми курсами, источниками, конспектами, карточками, тестами и связями."
              : "Downloads one JSON file containing courses, sources, notes, flashcards, quizzes, and relationships."}
          </p>
          <Button onClick={doExport} disabled={itemCount === 0} title={itemCount === 0 ? (isRu ? "Экспортировать пока нечего" : "There is nothing to export yet") : undefined}>
            <Download className="h-4 w-4 me-1" />
            {t.export}
          </Button>
        </section>

        <section className="rounded-lg border border-border bg-surface p-6">
          <h2 className="font-semibold mb-2">{t.import}</h2>
          <p className="text-sm text-muted-foreground mb-4">
            {isRu
              ? "Восстанавливает резервную копию и полностью заменяет текущие данные только после отдельного подтверждения."
              : "Restores a backup and replaces current data only after a separate confirmation."}
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
                  ? "Удаляет все локальные данные Lamdan в этом браузере. Сначала экспортируй резервную копию, если данные могут понадобиться."
                  : "Deletes all Lamdan data stored in this browser. Export a backup first if you may need it later."}
              </p>
              <Button
                variant="destructive"
                disabled={itemCount === 0}
                title={itemCount === 0 ? (isRu ? "Локальное хранилище уже пустое" : "Local storage is already empty") : undefined}
                onClick={() => {
                  const confirmed = confirm(
                    isRu
                      ? "Безвозвратно удалить все данные Lamdan в этом браузере?"
                      : "Permanently delete all Lamdan data in this browser?",
                  );
                  if (!confirmed) return;
                  store.reset();
                  setError(null);
                  toast.success(isRu ? "Все локальные данные удалены" : "All local data was deleted");
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
