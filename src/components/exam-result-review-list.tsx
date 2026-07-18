import { Link } from "@tanstack/react-router";
import { BookOpenCheck, CheckCircle2, RotateCcw } from "lucide-react";
import { ExamResultIssueCard } from "@/components/exam-result-issue-card";
import { Button } from "@/components/ui/button";
import type { ExamSession } from "@/lib/exam-engine";
import type { AppData } from "@/lib/store";

export function ExamResultReviewList({
  session,
  isRu,
  data,
  onExit,
}: {
  session: ExamSession;
  isRu: boolean;
  data: AppData;
  onExit: () => void;
}) {
  const result = session.result;
  if (!result) return null;
  const rows = session.questions.map((question) => ({
    question,
    result: result.questions.find((item) => item.questionId === question.questionId),
  }));
  const issues = rows.filter((row) => row.result?.correct !== true);
  const correctRows = rows.filter((row) => row.result?.correct === true);

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.17em] text-red-200">
            {isRu ? "Разбор результата" : "Result review"}
          </div>
          <h2 className="mt-1 font-serif text-2xl font-semibold">
            {issues.length > 0
              ? isRu
                ? `${issues.length} вопросов требуют возврата к источнику`
                : `${issues.length} questions need source review`
              : isRu
                ? "Ошибок и пропусков в этой попытке нет"
                : "No mistakes or omissions in this attempt"}
          </h2>
        </div>
        <Button asChild>
          <Link to="/app/quizzes/$quizId" params={{ quizId: session.quizId }}>
            <BookOpenCheck className="h-4 w-4 me-1" />
            {isRu ? "Открыть банк в тренажёре" : "Open bank in trainer"}
          </Link>
        </Button>
      </div>

      {issues.length > 0 ? (
        <div className="mt-4 space-y-3">
          {issues.map(({ question, result: questionResult }, index) => (
            <ExamResultIssueCard
              key={question.questionId}
              question={question}
              result={questionResult}
              index={index}
              isRu={isRu}
              data={data}
            />
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4 text-sm">
          <strong className="text-emerald-200">
            {isRu
              ? "Все вопросы этой сессии отвечены верно"
              : "Every question in this session was correct"}
          </strong>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {isRu
              ? "Это не отменяет повторение: результат описывает только одну конкретную frozen session."
              : "Review still matters: this result describes only one frozen session."}
          </p>
        </div>
      )}

      {correctRows.length > 0 && (
        <details className="mt-5 rounded-xl border border-border bg-background p-4">
          <summary className="cursor-pointer text-sm font-medium">
            {isRu
              ? `Правильные ответы этой попытки · ${correctRows.length}`
              : `Correct answers in this attempt · ${correctRows.length}`}
          </summary>
          <div className="mt-3 space-y-2">
            {correctRows.map(({ question }) => (
              <div key={question.questionId} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                <span dir="auto">{question.prompt}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <Button variant="outline" onClick={onExit}>
          <RotateCcw className="h-4 w-4 me-1" />
          {isRu ? "К blueprints" : "Back to blueprints"}
        </Button>
        <Button asChild variant="ghost">
          <Link to="/app/quizzes/$quizId" params={{ quizId: session.quizId }}>
            {isRu ? "Повторить исходную диагностику" : "Repeat the source diagnostic"}
          </Link>
        </Button>
      </div>
    </section>
  );
}
