import { Link } from "@tanstack/react-router";
import { ArrowRight, CircleHelp, Layers3, NotebookPen } from "lucide-react";
import type { PersistStudyPackResult } from "@/lib/study-pack-persistence";

export function StudyPackContinuation({
  result,
  isRu,
  onNavigate,
}: {
  result: PersistStudyPackResult;
  isRu: boolean;
  onNavigate: () => void;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-primary">
            {isRu ? "Продолжить занятие" : "Continue the session"}
          </div>
          <h3 className="mt-1 font-serif text-lg font-semibold">
            {isRu ? "Не теряй учебный маршрут" : "Keep the study route moving"}
          </h3>
          <p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">
            {isRu
              ? "Сначала закрепи структуру в конспекте, затем попробуй воспроизвести материал и только после этого проверь себя вопросами."
              : "First anchor the structure in the note, then recall it with cards, and only then test yourself with questions."}
          </p>
        </div>
        <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <Link
          to="/app/notes/$noteId"
          params={{ noteId: result.noteId }}
          onClick={onNavigate}
          className="group rounded-lg border border-primary/35 bg-primary/5 p-3 transition-[transform,border-color,background-color] hover:-translate-y-0.5 hover:border-primary/60 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-primary">
            <NotebookPen className="h-4 w-4" />1 · {isRu ? "Понять" : "Understand"}
          </span>
          <strong className="mt-2 block text-sm">
            {isRu ? "Открыть конспект" : "Open the note"}
          </strong>
          <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">
            {isRu ? "Проверь структуру и формулировки." : "Review the structure and wording."}
          </span>
        </Link>

        <Link
          to="/app/flashcards"
          onClick={onNavigate}
          className="group rounded-lg border border-border bg-background p-3 transition-[transform,border-color,background-color] hover:-translate-y-0.5 hover:border-primary/45 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <Layers3 className="h-4 w-4" />2 · {isRu ? "Вспомнить" : "Recall"}
          </span>
          <strong className="mt-2 block text-sm">
            {isRu
              ? `Повторить карточки · ${result.flashcardIds.length}`
              : `Review cards · ${result.flashcardIds.length}`}
          </strong>
          <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">
            {isRu
              ? "Новые карточки уже ждут повторения."
              : "The new cards are already due for review."}
          </span>
        </Link>

        {result.quizId ? (
          <Link
            to="/app/quizzes/$quizId"
            params={{ quizId: result.quizId }}
            onClick={onNavigate}
            className="group rounded-lg border border-border bg-background p-3 transition-[transform,border-color,background-color] hover:-translate-y-0.5 hover:border-primary/45 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              <CircleHelp className="h-4 w-4" />3 · {isRu ? "Проверить" : "Test"}
            </span>
            <strong className="mt-2 block text-sm">
              {isRu
                ? `Пройти диагностику · ${result.questionIds.length}`
                : `Run diagnostic · ${result.questionIds.length}`}
            </strong>
            <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">
              {isRu
                ? "Ответы станут evidence по понятиям."
                : "Answers become evidence for linked concepts."}
            </span>
          </Link>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-3 text-muted-foreground">
            <span className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em]">
              <CircleHelp className="h-4 w-4" />3 · {isRu ? "Проверить" : "Test"}
            </span>
            <strong className="mt-2 block text-sm text-foreground">
              {isRu ? "Диагностика не создана" : "No diagnostic created"}
            </strong>
            <span className="mt-1 block text-[11px] leading-4">
              {isRu ? "В комплекте не было вопросов." : "The pack did not contain questions."}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
