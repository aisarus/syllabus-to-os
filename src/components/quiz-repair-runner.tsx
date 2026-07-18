import { Link } from "@tanstack/react-router";
import { CheckCircle2, CircleAlert, RotateCcw, Wrench, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/app-context";
import { parseGoldenQuizFeedback } from "@/lib/golden-quiz";
import { validateQuestion } from "@/components/quiz-library";
import { recordQuizAttemptWithAnswers, type RecordedQuizAttempt } from "@/lib/quiz-attempt-details";
import { useData } from "@/lib/store";

export function QuizRepairRunner({
  quizId,
  requestedQuestionIds,
}: {
  quizId: string;
  requestedQuestionIds: string[];
}) {
  const { lang } = useApp();
  const isRu = lang === "ru";
  const data = useData();
  const quiz = data.quizzes.find((item) => item.id === quizId);
  const questions = useMemo(() => {
    const byId = new Map(
      data.quizQuestions
        .filter((question) => question.quizId === quizId && validateQuestion(question).valid)
        .map((question) => [question.id, question]),
    );
    return requestedQuestionIds.flatMap((id) => {
      const question = byId.get(id);
      return question ? [question] : [];
    });
  }, [data.quizQuestions, quizId, requestedQuestionIds]);
  const [index, setIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [recorded, setRecorded] = useState<RecordedQuizAttempt | null>(null);
  const current = questions[index];
  const feedback = current
    ? parseGoldenQuizFeedback(current.explanation, current.options.length)
    : null;
  const answeredCorrectly = current && selectedIndex === current.correctIndex;

  const next = () => {
    if (!current || selectedIndex === null) return;
    const nextAnswers = { ...answers, [current.id]: selectedIndex };
    if (index >= questions.length - 1) {
      try {
        const result = recordQuizAttemptWithAnswers({
          quizId,
          mode: "trainer",
          questions,
          answers: nextAnswers,
        });
        setAnswers(nextAnswers);
        setRecorded(result);
        toast.success(
          isRu
            ? "Repair-попытка сохранена отдельно от экзамена"
            : "The repair attempt was saved separately from the exam",
        );
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error));
      }
      return;
    }
    setAnswers(nextAnswers);
    setIndex((value) => value + 1);
    setSelectedIndex(null);
  };

  if (!quiz) {
    return <RepairUnavailable quizId={quizId} isRu={isRu} reason="quiz" />;
  }

  if (questions.length === 0) {
    return <RepairUnavailable quizId={quizId} isRu={isRu} reason="questions" />;
  }

  if (recorded) {
    return (
      <section className="mx-auto max-w-4xl rounded-2xl border border-border bg-surface p-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
        <h1 className="mt-3 font-serif text-2xl font-semibold">
          {recorded.attempt.score}% · {recorded.attempt.correctCount}/{recorded.attempt.total}
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          {isRu
            ? `Создана новая попытка по ${recorded.detail.answers.length} вопросам. Frozen exam result не изменён.`
            : `A new attempt was created for ${recorded.detail.answers.length} questions. The frozen exam result was not changed.`}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setIndex(0);
              setSelectedIndex(null);
              setAnswers({});
              setRecorded(null);
            }}
          >
            <RotateCcw className="h-4 w-4 me-1" />
            {isRu ? "Повторить эти вопросы" : "Repeat these questions"}
          </Button>
          <Button asChild>
            <Link to="/app/quizzes/$quizId" params={{ quizId }} search={{ repair: [] }}>
              {isRu ? "Открыть весь банк" : "Open the full bank"}
            </Link>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <section className="rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Wrench className="mt-0.5 h-5 w-5 shrink-0 text-yellow-200" />
            <div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-yellow-200">
                {isRu ? "Repair после экзамена" : "Post-exam repair"}
              </div>
              <h1 className="mt-1 font-serif text-2xl font-semibold">{quiz.title}</h1>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {isRu
                  ? `В эту отдельную попытку вошли только ${questions.length} ошибочных или пропущенных вопросов из frozen result.`
                  : `This separate attempt contains only ${questions.length} missed or unanswered questions from the frozen result.`}
              </p>
            </div>
          </div>
          <Button asChild size="sm" variant="ghost">
            <Link to="/app/quizzes/$quizId" params={{ quizId }} search={{ repair: [] }}>
              {isRu ? "Весь банк" : "Full bank"}
            </Link>
          </Button>
        </div>
      </section>

      <div className="mt-5 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {isRu ? "Вопрос" : "Question"} {index + 1}/{questions.length}
        </span>
        <span>
          {Object.keys(answers).length} {isRu ? "ответов в черновике" : "draft answers"}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-[width]"
          style={{ width: `${((index + 1) / questions.length) * 100}%` }}
        />
      </div>

      <article className="mt-4 rounded-2xl border border-border bg-surface p-5 md:p-7">
        <h2 dir="auto" className="font-serif text-2xl font-semibold leading-10">
          {current.prompt}
        </h2>
        <div className="mt-6 space-y-3">
          {current.options.map((option, optionIndex) => {
            const selected = selectedIndex === optionIndex;
            const correct = optionIndex === current.correctIndex;
            const stateClass =
              selectedIndex === null
                ? "border-border bg-background hover:border-primary/60"
                : correct
                  ? "border-emerald-500/60 bg-emerald-500/10"
                  : selected
                    ? "border-red-500/60 bg-red-500/10"
                    : "border-border bg-background";
            return (
              <button
                key={optionIndex}
                type="button"
                disabled={selectedIndex !== null}
                className={`flex w-full items-start gap-3 rounded-xl border p-4 text-start ${stateClass}`}
                onClick={() => setSelectedIndex(optionIndex)}
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-current text-xs font-semibold">
                  {String.fromCharCode(65 + optionIndex)}
                </span>
                <span dir="auto" className="min-w-0 flex-1">
                  {option}
                </span>
                {selectedIndex !== null && correct && (
                  <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                )}
                {selectedIndex !== null && selected && !correct && (
                  <XCircle className="h-5 w-5 text-red-300" />
                )}
              </button>
            );
          })}
        </div>

        {selectedIndex !== null && (
          <div
            className={`mt-5 rounded-xl border p-4 ${answeredCorrectly ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"}`}
          >
            <strong>
              {answeredCorrectly ? (isRu ? "Верно" : "Correct") : isRu ? "Неверно" : "Incorrect"}
            </strong>
            {feedback?.memoryHint && (
              <p dir="auto" className="mt-2 text-sm text-muted-foreground">
                {feedback.memoryHint}
              </p>
            )}
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <Button onClick={next} disabled={selectedIndex === null}>
            {index >= questions.length - 1
              ? isRu
                ? "Сохранить repair-попытку"
                : "Save repair attempt"
              : isRu
                ? "Следующий вопрос"
                : "Next question"}
          </Button>
        </div>
      </article>
    </div>
  );
}

function RepairUnavailable({
  quizId,
  isRu,
  reason,
}: {
  quizId: string;
  isRu: boolean;
  reason: "quiz" | "questions";
}) {
  return (
    <section className="mx-auto max-w-3xl rounded-2xl border border-dashed border-border bg-surface p-10 text-center">
      <CircleAlert className="mx-auto h-10 w-10 text-yellow-200" />
      <h1 className="mt-3 font-serif text-xl font-semibold">
        {reason === "quiz"
          ? isRu
            ? "Банк вопросов больше недоступен"
            : "The question bank is unavailable"
          : isRu
            ? "В repair-ссылке не осталось валидных вопросов"
            : "No valid questions remain in the repair link"}
      </h1>
      <Button asChild className="mt-5">
        <Link to="/app/quizzes/$quizId" params={{ quizId }} search={{ repair: [] }}>
          {isRu ? "Открыть обычный квиз" : "Open the regular quiz"}
        </Link>
      </Button>
    </section>
  );
}
