import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/lib/app-context";
import { useData, store } from "@/lib/store";
import { ArrowLeft, Plus, Trash2, Check } from "lucide-react";

export const Route = createFileRoute("/app/quizzes/$quizId")({
  component: QuizDetail,
});

function QuizDetail() {
  const { quizId } = Route.useParams();
  const { t } = useApp();
  const data = useData();
  const navigate = useNavigate();
  const quiz = data.quizzes.find((q) => q.id === quizId);
  const questions = data.quizQuestions.filter((q) => q.quizId === quizId);
  const attempts = data.quizAttempts.filter((a) => a.quizId === quizId);
  const [mode, setMode] = useState<"edit" | "take" | "result">("edit");
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<{ correct: number; total: number; score: number } | null>(null);

  if (!quiz) {
    return (
      <div>
        <Button variant="ghost" onClick={() => navigate({ to: "/app/quizzes" })}>
          <ArrowLeft className="h-4 w-4 me-1" />{t.back}
        </Button>
      </div>
    );
  }

  const addQ = () => {
    store.addQuestion({ quizId, prompt: "New question", options: ["Option A", "Option B"], correctIndex: 0 });
  };

  const submit = () => {
    let correct = 0;
    questions.forEach((q) => {
      if (answers[q.id] === q.correctIndex) correct++;
    });
    const score = questions.length === 0 ? 0 : Math.round((correct / questions.length) * 100);
    store.recordAttempt({ quizId, score, correctCount: correct, total: questions.length });
    setResult({ correct, total: questions.length, score });
    setMode("result");
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/app/quizzes" })} className="mb-3">
        <ArrowLeft className="h-4 w-4 me-1" />{t.back}
      </Button>
      <PageHeader
        title={quiz.title}
        actions={
          <>
            {mode === "edit" && (
              <Button onClick={() => { setAnswers({}); setMode("take"); }} disabled={questions.length === 0}>
                {t.takeQuiz}
              </Button>
            )}
            {mode !== "edit" && (
              <Button variant="outline" onClick={() => setMode("edit")}>{t.edit}</Button>
            )}
          </>
        }
      />

      {mode === "edit" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button onClick={addQ}><Plus className="h-4 w-4 me-1" />{t.addQuestion}</Button>
          </div>
          {questions.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-muted-foreground">{t.empty}</div>
          )}
          {questions.map((q, idx) => (
            <div key={q.id} className="rounded-lg border border-border bg-surface p-4 space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-xs text-muted-foreground mt-2">{idx + 1}.</span>
                <Input value={q.prompt} onChange={(e) => store.updateQuestion(q.id, { prompt: e.target.value })} />
                <Button size="icon" variant="ghost" onClick={() => store.deleteQuestion(q.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="space-y-1 ps-6">
                {q.options.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <button
                      onClick={() => store.updateQuestion(q.id, { correctIndex: oi })}
                      className={`h-5 w-5 rounded-full border flex items-center justify-center ${q.correctIndex === oi ? "bg-primary border-primary text-primary-foreground" : "border-border"}`}
                      title={t.correct}
                    >
                      {q.correctIndex === oi && <Check className="h-3 w-3" />}
                    </button>
                    <Input
                      value={opt}
                      onChange={(e) => {
                        const options = [...q.options];
                        options[oi] = e.target.value;
                        store.updateQuestion(q.id, { options });
                      }}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        const options = q.options.filter((_, i) => i !== oi);
                        store.updateQuestion(q.id, {
                          options,
                          correctIndex: Math.min(q.correctIndex, options.length - 1),
                        });
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <Button size="sm" variant="ghost" onClick={() => store.updateQuestion(q.id, { options: [...q.options, "New option"] })}>
                  <Plus className="h-3.5 w-3.5 me-1" />{t.add}
                </Button>
              </div>
            </div>
          ))}
          <div className="mt-6">
            <Label>{t.attempts}</Label>
            <div className="mt-2 space-y-1 text-xs">
              {attempts.length === 0 && <div className="text-muted-foreground">{t.none}</div>}
              {attempts.map((a) => (
                <div key={a.id} className="flex justify-between rounded bg-surface border border-border p-2">
                  <span>{new Date(a.takenAt).toLocaleString()}</span>
                  <span className="font-mono">{a.correctCount}/{a.total} · {a.score}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {mode === "take" && (
        <div className="space-y-4">
          {questions.map((q, idx) => (
            <div key={q.id} className="rounded-lg border border-border bg-surface p-4">
              <div className="font-medium mb-3">{idx + 1}. {q.prompt}</div>
              <div className="space-y-2">
                {q.options.map((opt, oi) => (
                  <label key={oi} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name={q.id}
                      checked={answers[q.id] === oi}
                      onChange={() => setAnswers({ ...answers, [q.id]: oi })}
                    />
                    <span className="text-sm">{opt}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
          <Button onClick={submit}>{t.submitQuiz}</Button>
        </div>
      )}

      {mode === "result" && result && (
        <div className="rounded-lg border border-border bg-surface p-6 text-center space-y-3">
          <div className="text-5xl font-bold">{result.score}%</div>
          <div className="text-sm text-muted-foreground">{result.correct} / {result.total}</div>
          <div className="space-y-2 text-start mt-4">
            {questions.map((q, idx) => {
              const chosen = answers[q.id];
              const ok = chosen === q.correctIndex;
              return (
                <div key={q.id} className={`rounded p-3 border ${ok ? "border-green-500/40 bg-green-500/10" : "border-red-500/40 bg-red-500/10"}`}>
                  <div className="text-sm font-medium">{idx + 1}. {q.prompt}</div>
                  <div className="text-xs mt-1">Your: {chosen != null ? q.options[chosen] : "—"}</div>
                  {!ok && <div className="text-xs">Correct: {q.options[q.correctIndex]}</div>}
                </div>
              );
            })}
          </div>
          <div className="flex justify-center gap-2 pt-2">
            <Button onClick={() => { setAnswers({}); setResult(null); setMode("take"); }}>{t.retry}</Button>
            <Button variant="outline" onClick={() => setMode("edit")}>{t.close}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
