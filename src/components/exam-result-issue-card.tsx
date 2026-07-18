import { Link } from "@tanstack/react-router";
import { CircleAlert, ExternalLink, XCircle } from "lucide-react";
import type { ExamQuestionResult, FrozenExamQuestion } from "@/lib/exam-engine";
import type { AppData } from "@/lib/store";

export function ExamResultIssueCard({
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
  data: AppData;
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
            {index + 1} ·{" "}
            {unanswered ? (isRu ? "Пропуск" : "Unanswered") : isRu ? "Ошибка" : "Mistake"}
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
              }
              tone="failure"
            />
            <AnswerBox
              label={isRu ? "Правильный ответ" : "Correct answer"}
              value={question.options[question.correctIndex] ?? "—"}
              tone="success"
            />
          </div>
          {question.explanation && (
            <p
              dir="auto"
              className="mt-3 whitespace-pre-wrap text-xs leading-5 text-muted-foreground"
            >
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
      className={`rounded-lg border p-3 ${
        tone === "failure"
          ? "border-red-500/25 bg-red-500/5"
          : "border-emerald-500/25 bg-emerald-500/5"
      }`}
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
