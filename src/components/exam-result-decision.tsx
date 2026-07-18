import { Link } from "@tanstack/react-router";
import {
  BookOpenCheck,
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/app-context";
import type { ExamQuestionResult, ExamSession, FrozenExamQuestion } from "@/lib/exam-engine";
import { useData } from "@/lib/store";

export function ExamResultDecision({
  session,
  onExit,
}: {
  session: ExamSession;
  onExit: () => void;
}) {
  const { lang } = useApp();
  const isRu = lang === "ru";
  const data = useData();
  const result = session.result;
  if (!result) return null;

  const rows = session.questions.map((question) => ({
    question,
    result: result.questions.find((item) => item.questionId === question.questionId),
  }));
  const issues = rows.filter((row) => row.result?.correct !== true);
  const correctRows = rows.filter((row) => row.result?.correct === true);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <section className="rounded-2xl border border-border bg-surface p-5 md:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-primary">
              <ShieldCheck className="h-4 w-4" />
              {isRu ? "Сохранённый frozen result" : "Saved frozen result"}
            </div>
            <h1 className="mt-2 font-serif text-3xl font-semibold">{session.title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {isRu
                ? "Prompt, варианты, правильные ответы и source relationships взяты из замороженной сессии. Ниже показан факт этой попытки, а не прогноз оценки или доказательство освоения."
                : "Prompts, options, correct answers, and source relationships come from the frozen session. This is evidence from one attempt, not a grade prediction or proof of mastery."}
            </p>
          </div>
          <div className="rounded-xl border border-primary/30 bg-primary/5 px-5 py-4 text-center">
            <div className="font-mono text-3xl font-semibold text-primary">{result.score}%</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {isRu ? "сырой score" : "raw score"}
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label={isRu ? "Правильно" : "Correct"} value={result.correctCount} />
          <Metric label={isRu ? "Отвечено" : "Answered"} value={result.answeredCount} />
          <Metric label={isRu ? "Без ответа" : "Unanswered"} value={result.unansweredCount} />
          <Metric label={isRu ? "Всего" : "Total"} value={result.total} />
        </div>
      </section>

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
              <IssueCard
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
              {isRu ? "Все вопросы этой сессии отвечены верно" : "Every question in this session was correct"}
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
    </div>
  );
}

function IssueCard({
  question,
  result,
  index,
  isRu,
  data,
}: {
  question: FrozenExamQuestion;
  result?: ExamQuestionResult;
  index: number;
  isRu: boolean;
  data: ReturnType<typeof useData>;
}) {
  const selectedIndex = result?.selectedIndex;
  const unanswered = result?.unanswered !== false;
  const sourceChunk = question.sourceChunkIds
    .map((id) => data.materialChunks.find((chunk) => chunk.id === id))
    .find(Boolean);
  const sourceMaterial = sourceChunk
    ? data.materials.find((material) => material.id === sourceChunk.materialId)
    : undefined;

  return (
    <article className="rounded-xl border border-red-500/20 bg-background p-4">
      <div className="flex items-start gap-3">
        {unanswered ? (
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-yellow-200" />
        ) : (
          <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {index + 1} · {unanswered ? (isRu ? "Пропуск" : "Unanswered") : isRu ? "Ошибка" : "Mistake"}
          </div>
          <strong dir="auto" className="mt-1 block text-sm leading-6">
            {question.prompt}
          </strong>
          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
            <AnswerBox
              label={isRu ? "Твой ответ" : "Your answer"}
              value={
                selectedIndex === undefined
                  ? isRu
                    ? "без ответа"
                    : "unanswered"
                  : (question.options[selectedIndex] ?? "—")
              tone="failure"
            />
            <AnswerBox
              label={isRu ? "Правильный ответ" : "Correct answer"}
              value={question.options[question.correctIndex] ?? "—"}
              tone="success"
            />
          </div>
          {question.explanation && (
            <p dir="auto" className="mt-3 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">
              {question.explanation}
            </p>
          )}
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
                ? "Frozen source ID сохранён, но исходный chunk больше недоступен. Результат попытки не изменён; источник нужно восстановить отдельно."
                : "The frozen source ID remains, but the original chunk is unavailable. The attempt result is unchanged; restore the source separately."}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

function AnswerBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "failure" | "success";
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${tone === "failure" ? "border-red-500/25 bg-red-500/5" : "border-emerald-500/25 bg-emerald-500/5"}`}
    >
      <span className="block text-[10px] uppercase tracking-[0.13em] text-muted-foreground">
        {label}
      </span>
      <span dir="auto" className="mt-1 block">
        {value}
      </span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3 text-center">
      <div className="font-mono text-xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
