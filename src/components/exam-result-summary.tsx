import { ShieldCheck } from "lucide-react";
import type { ExamSession } from "@/lib/exam-engine";

export function ExamResultSummary({ session, isRu }: { session: ExamSession; isRu: boolean }) {
  const result = session.result;
  if (!result) return null;

  return (
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
