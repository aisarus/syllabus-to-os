import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ExamSession } from "@/lib/exam-engine";

export function ExamEngineRestoredResult({
  session,
  onExit,
}: {
  session: ExamSession;
  onExit: () => void;
}) {
  const result = session.result;
  if (!result) return null;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <section className="rounded-xl border border-border bg-surface p-5 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Замороженный результат экзамена
            </p>
            <h1 className="mt-2 font-serif text-3xl font-semibold">{session.title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Результат восстановлен из локальной frozen session после reload. Вопросы, ответы и
              source relationships не пересчитывались.
            </p>
          </div>
          <div className="rounded-xl border border-primary/30 bg-primary/5 px-5 py-4 text-center">
            <div className="font-mono text-3xl font-semibold text-primary">{result.score}%</div>
            <div className="mt-1 text-xs text-muted-foreground">сырой score</div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Правильно" value={result.correctCount} />
          <Metric label="Отвечено" value={result.answeredCount} />
          <Metric label="Без ответа" value={result.unansweredCount} />
          <Metric label="Всего" value={result.total} />
        </div>

        <div className="mt-5 space-y-3">
          {session.questions.map((question) => {
            const questionResult = result.questions.find(
              (item) => item.questionId === question.questionId,
            );
            const selectedIndex = questionResult?.selectedIndex;
            const correct = questionResult?.correct === true;
            return (
              <article key={question.questionId} className="rounded-lg border border-border p-4">
                <div className="flex items-start gap-3">
                  {correct ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                  ) : (
                    <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
                  )}
                  <div className="min-w-0">
                    <strong className="block">{question.prompt}</strong>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Выбрано: {selectedIndex === undefined ? "без ответа" : question.options[selectedIndex]}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Правильный ответ: {question.options[question.correctIndex]}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <Button className="mt-5" variant="outline" onClick={onExit}>
          <RotateCcw className="me-1 h-4 w-4" />
          К blueprints
        </Button>
      </section>
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
