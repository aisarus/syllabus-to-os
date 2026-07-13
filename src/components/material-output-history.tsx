import { Link } from "@tanstack/react-router";
import { ExternalLink, FileQuestion, FileText, Layers3, Presentation, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/app-context";
import {
  updateData,
  useData,
  type Material,
  type MaterialOutput,
  type MaterialOutputType,
} from "@/lib/store";

export function MaterialOutputHistory({ material }: { material: Material }) {
  const { lang } = useApp();
  const data = useData();
  const isRu = lang === "ru";
  const history = data.materialOutputs
    .filter((item) => item.materialId === material.id)
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt);
  const notes = data.notes.filter((item) => item.materialId === material.id);
  const cards = data.flashcards.filter((item) => item.materialId === material.id);
  const quizzes = data.quizzes.filter((item) => item.materialId === material.id);
  const outlines = data.presentationOutlines.filter((item) => item.materialId === material.id);
  const hasOutputs = notes.length + cards.length + quizzes.length + outlines.length > 0;

  return (
    <section className="mt-4 rounded-lg border border-border bg-surface p-4 md:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-serif text-xl font-semibold">
            {isRu ? "Результаты и история материала" : "Material outputs and history"}
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {isRu
              ? "Здесь остаётся след каждого сохранённого результата. Удаление строки истории не удаляет сам конспект, карточки или тест."
              : "Every saved result leaves a trace here. Removing a history row does not delete the note, cards or quiz itself."}
          </p>
        </div>
        <span className="rounded border border-border bg-background px-2 py-1 text-xs text-muted-foreground">
          {history.length} {isRu ? "событий" : "events"}
        </span>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {isRu ? "Сохранённые результаты" : "Saved outputs"}
          </h3>
          {!hasOutputs ? (
            <div className="mt-2 rounded-md border border-dashed border-border p-5 text-sm text-muted-foreground">
              {isRu
                ? "Из этого материала пока ничего не сохранено."
                : "Nothing has been saved from this material yet."}
            </div>
          ) : (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {notes.map((note) => (
                <OutputEntityLink
                  key={note.id}
                  to="/app/notes/$noteId"
                  params={{ noteId: note.id }}
                  icon={FileText}
                  title={note.title || (isRu ? "Без названия" : "Untitled")}
                  meta={isRu ? "Конспект" : "Note"}
                />
              ))}
              {quizzes.map((quiz) => (
                <OutputEntityLink
                  key={quiz.id}
                  to="/app/quizzes/$quizId"
                  params={{ quizId: quiz.id }}
                  icon={FileQuestion}
                  title={quiz.title}
                  meta={isRu ? "Тест" : "Quiz"}
                />
              ))}
              {outlines.map((outline) => (
                <OutputEntityLink
                  key={outline.id}
                  to="/app/presentations/$outlineId"
                  params={{ outlineId: outline.id }}
                  icon={Presentation}
                  title={outline.title}
                  meta={isRu ? "План презентации" : "Presentation outline"}
                />
              ))}
              {cards.length > 0 && (
                <OutputEntityLink
                  to="/app/flashcards"
                  icon={Layers3}
                  title={`${cards.length} ${isRu ? "карточек" : "flashcards"}`}
                  meta={isRu ? "Карточки из материала" : "Cards from material"}
                />
              )}
            </div>
          )}
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {isRu ? "История генераций" : "Generation history"}
          </h3>
          {history.length === 0 ? (
            <div className="mt-2 rounded-md border border-dashed border-border p-5 text-sm text-muted-foreground">
              {isRu
                ? "История появится после сохранения AI-черновика."
                : "History appears after an AI draft is saved."}
            </div>
          ) : (
            <div className="mt-2 divide-y divide-border rounded-md border border-border bg-background">
              {history.map((output) => (
                <HistoryRow key={output.id} output={output} material={material} isRu={isRu} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function HistoryRow({
  output,
  material,
  isRu,
}: {
  output: MaterialOutput;
  material: Material;
  isRu: boolean;
}) {
  const data = useData();
  const target = resolveOutputTarget(data, output, material.id, isRu);

  return (
    <div className="flex items-start gap-3 p-3">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded border border-border bg-surface">
        <target.icon className="h-4 w-4 text-primary" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <strong className="text-sm">{outputTypeCopy(output.type, isRu)}</strong>
          {!target.exists && (
            <span className="rounded bg-yellow-500/10 px-1.5 py-0.5 text-[10px] text-yellow-200">
              {isRu ? "Результат удалён или не найден" : "Output deleted or missing"}
            </span>
          )}
        </div>
        <div className="mt-1 truncate text-xs text-muted-foreground">{target.title}</div>
        <time className="mt-1 block text-[10px] text-muted-foreground">
          {new Date(output.createdAt).toLocaleString(isRu ? "ru-RU" : "en-GB")}
        </time>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {target.exists && target.to && (
          <Link
            to={target.to as never}
            params={target.params as never}
            className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs text-primary hover:bg-accent"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {isRu ? "Открыть" : "Open"}
          </Link>
        )}
        <Button
          size="icon"
          variant="ghost"
          aria-label={isRu ? "Удалить запись истории" : "Remove history entry"}
          title={
            isRu
              ? "Удалить только запись истории, не сам результат"
              : "Remove only the history entry, not the output"
          }
          onClick={() => {
            const confirmed = confirm(
              isRu
                ? "Удалить эту запись истории? Сам сохранённый результат останется."
                : "Remove this history entry? The saved output itself will remain.",
            );
            if (!confirmed) return;
            updateData((current) => ({
              ...current,
              materialOutputs: current.materialOutputs.filter((item) => item.id !== output.id),
            }));
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function OutputEntityLink({
  to,
  params,
  icon: Icon,
  title,
  meta,
}: {
  to: string;
  params?: Record<string, string>;
  icon: typeof FileText;
  title: string;
  meta: string;
}) {
  return (
    <Link
      to={to as never}
      params={params as never}
      className="flex min-w-0 items-start gap-3 rounded-md border border-border bg-background p-3 hover:bg-accent"
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <span className="min-w-0">
        <strong className="block truncate text-sm">{title}</strong>
        <span className="mt-1 block text-[11px] text-muted-foreground">{meta}</span>
      </span>
    </Link>
  );
}

function resolveOutputTarget(
  data: ReturnType<typeof useData>,
  output: MaterialOutput,
  materialId: string,
  isRu: boolean,
): {
  exists: boolean;
  title: string;
  to?: string;
  params?: Record<string, string>;
  icon: typeof FileText;
} {
  if (output.type === "note") {
    const note = data.notes.find((item) => item.id === output.linkedEntityId);
    return note
      ? {
          exists: true,
          title: note.title || (isRu ? "Без названия" : "Untitled"),
          to: "/app/notes/$noteId",
          params: { noteId: note.id },
          icon: FileText,
        }
      : {
          exists: false,
          title: output.linkedEntityId ?? (isRu ? "Нет связанного ID" : "No linked ID"),
          icon: FileText,
        };
  }

  if (output.type === "quiz") {
    const quiz = data.quizzes.find((item) => item.id === output.linkedEntityId);
    return quiz
      ? {
          exists: true,
          title: quiz.title,
          to: "/app/quizzes/$quizId",
          params: { quizId: quiz.id },
          icon: FileQuestion,
        }
      : {
          exists: false,
          title: output.linkedEntityId ?? (isRu ? "Нет связанного ID" : "No linked ID"),
          icon: FileQuestion,
        };
  }

  if (output.type === "outline" || output.type === "presentation_outline") {
    const outline = data.presentationOutlines.find((item) => item.id === output.linkedEntityId);
    return outline
      ? {
          exists: true,
          title: outline.title,
          to: "/app/presentations/$outlineId",
          params: { outlineId: outline.id },
          icon: Presentation,
        }
      : {
          exists: false,
          title: output.linkedEntityId ?? (isRu ? "Нет связанного ID" : "No linked ID"),
          icon: Presentation,
        };
  }

  if (output.type === "flashcards") {
    const count = data.flashcards.filter((item) => item.materialId === materialId).length;
    return count > 0
      ? {
          exists: true,
          title: `${count} ${isRu ? "карточек из материала" : "cards from material"}`,
          to: "/app/flashcards",
          icon: Layers3,
        }
      : {
          exists: false,
          title: isRu ? "Карточки больше не найдены" : "No generated cards remain",
          icon: Layers3,
        };
  }

  return {
    exists: false,
    title: output.linkedEntityId ?? (isRu ? "Неподдерживаемый результат" : "Unsupported output"),
    icon: FileText,
  };
}

function outputTypeCopy(type: MaterialOutputType, isRu: boolean): string {
  const map: Record<MaterialOutputType, [string, string]> = {
    note: ["Конспект", "Note"],
    quiz: ["Тест", "Quiz"],
    flashcards: ["Карточки", "Flashcards"],
    outline: ["План", "Outline"],
    presentation_outline: ["План презентации", "Presentation outline"],
    task_list: ["Список задач", "Task list"],
  };
  return map[type][isRu ? 0 : 1];
}
