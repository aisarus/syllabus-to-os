import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  GraduationCap,
  RotateCcw,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  QuizAttemptAnswerSnapshot,
  RecordedQuizAttempt,
} from "@/lib/quiz-attempt-details";
import { useData } from "@/lib/store";

export function QuizResultDecision({
  recorded,
  quizId,
  courseId,
  isRu,
  onRestart,
  onRepair,
}: {
  recorded: RecordedQuizAttempt;
  quizId: string;
  courseId?: string;
  isRu: boolean;
  onRestart: () => void;
  onRepair: (questionIds: string[]) => void;
}) {
  const wrongAnswers = recorded.detail.answers.filter((answer) => !answer.correct);

  return (
    <section className="mt-5 rounded-2xl border border-border bg-surface p-5 md:p-6">
      <div className="text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
        <h2 className="mt-3 font-serif text-2xl font-semibold">
          {recorded.attempt.score}% · {recorded.attempt.correctCount}/{recorded.attempt.total}
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          {isRu
            ? `Сохранено ${recorded.detail.answers.length} снимков ответов. Редактирование вопроса позже не изменит эту историю.`
            : `${recorded.detail.answers.length} answer snapshots were saved. Editing a question later will not rewrite this history.`}
        </p>
        {!recorded.persistenceOk && (
          <p className="mx-auto mt-3 max-w-xl rounded border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-200">
            {recorded.error}
          </p>
        )}
      </div>

      {wrongAnswers.length > 0 ? (
        <div className="mt-6">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.17em] text-red-200">
                {isRu ? "Evidence для исправления" : "Repair evidence"}
              </div>
              <h3 className="mt-1 font-serif text-xl font-semibold">
                {isRu
                  ? `${wrongAnswers.length} ошибок требуют разбора`
                  : `${wrongAnswers.length} mistakes need repair`}
              </h3>
            </div>
            <Button
              type="button"
              onClick={() => onRepair(wrongAnswers.map((answer) => answer.questionId))}
            >
              <Wrench className="h-4 w-4 me-1" />
              {isRu
                ? `Повторить только ошибки (${wrongAnswers.length})`
                : `Retry mistakes only (${wrongAnswers.length})`}
            </Button>
          </div>

          <div className="mt-3 space-y-2">
            {wrongAnswers.map((answer, index) => (
              <WrongAnswerCard key={answer.questionId} answer={answer} index={index} isRu={isRu} />
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4 text-sm">
          <strong className="text-emerald-200">
            {isRu ? "Ошибок в этой попытке нет" : "No mistakes in this attempt"}
          </strong>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {isRu
              ? "Это факт только об этой попытке, а не доказательство устойчивого освоения темы."
              : "This describes only this attempt; it does not prove stable mastery."}
          </p>
        </div>
      )}

      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        <Button variant="outline" onClick={onRestart}>
          <RotateCcw className="h-4 w-4 me-1" />
          {isRu ? "Пройти весь тест ещё раз" : "Retry the full quiz"}
        </Button>
        <Button asChild>
          <Link to="/app/exam-engine" search={{ course: courseId ?? "", quiz: quizId }}>
            <GraduationCap className="h-4 w-4 me-1" />
            {isRu ? "Продолжить в Exam Engine" : "Continue in Exam Engine"}
            <ArrowRight className="h-4 w-4 ms-1" />
          </Link>
        </Button>
      </div>
    </section>
  );
}

function WrongAnswerCard({
  answer,
  index,
  isRu,
}: {
  answer: QuizAttemptAnswerSnapshot;
  index: number;
  isRu: boolean;
}) {
  const data = useData();
  const sourceChunk = answer.sourceChunkIds
    .map((id) => data.materialChunks.find((chunk) => chunk.id === id))
    .find(Boolean);
  const sourceMaterial = sourceChunk
    ? data.materials.find((material) => material.id === sourceChunk.materialId)
    : undefined;

  return (
    <article className="rounded-xl border border-red-500/20 bg-background p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-red-500/35 text-xs text-red-200">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <strong dir="auto" className="block text-sm leading-6">
            {answer.questionPrompt}
          </strong>
          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
            <div className="rounded-lg border border-red-500/25 bg-red-500/5 p-3">
              <span className="block text-[10px] uppercase tracking-[0.13em] text-red-200">
                {isRu ? "Твой ответ" : "Your answer"}
              </span>
              <span dir="auto" className="mt-1 block text-muted-foreground">
                {answer.selectedOption}
              </span>
            </div>
            <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3">
              <span className="block text-[10px] uppercase tracking-[0.13em] text-emerald-200">
                {isRu ? "Правильный ответ" : "Correct answer"}
              </span>
              <span dir="auto" className="mt-1 block text-muted-foreground">
                {answer.correctOption}
              </span>
            </div>
          </div>
          {sourceMaterial ? (
            <Link
              to="/app/materials/$materialId"
              params={{ materialId: sourceMaterial.id }}
              className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {isRu ? "Открыть подтверждающий источник" : "Open supporting source"}
              {sourceChunk?.pageNumber
                ? isRu
                  ? ` · стр. ${sourceChunk.pageNumber}`
                  : ` · p. ${sourceChunk.pageNumber}`
                : ""}
            </Link>
          ) : (
            <p className="mt-3 text-[11px] text-yellow-200">
              {isRu
                ? "Связанный source chunk больше недоступен — не используй этот вопрос как надёжное evidence."
                : "The linked source chunk is unavailable; do not treat this question as reliable evidence."}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
