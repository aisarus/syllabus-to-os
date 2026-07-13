import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  GraduationCap,
  Languages,
  RotateCcw,
  Settings2,
  Shuffle,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { AIGenerateButton } from "@/components/ai-generate-dialog";
import { QuizStudio } from "@/components/quiz-studio";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/app-context";
import {
  hasQuizTranslation,
  parseGoldenQuizFeedback,
  type GoldenQuizFeedback,
} from "@/lib/golden-quiz";
import { store, useData, type QuizQuestion } from "@/lib/store";

interface PresentedOption {
  originalIndex: number;
  text: string;
  translation?: string;
  rationale: string;
  correct: boolean;
}

interface PresentedQuestion {
  question: QuizQuestion;
  feedback: GoldenQuizFeedback;
  options: PresentedOption[];
}

export function GoldenQuizExperience({ quizId }: { quizId: string }) {
  const { lang } = useApp();
  const isRu = lang === "ru";
  const data = useData();
  const navigate = useNavigate();
  const quiz = data.quizzes.find((item) => item.id === quizId);
  const rawQuestions = data.quizQuestions.filter((question) => question.quizId === quizId);
  const [view, setView] = useState<"trainer" | "editor">("trainer");
  const [attemptNonce, setAttemptNonce] = useState(1);
  const [index, setIndex] = useState(0);
  const [selectedOriginalIndex, setSelectedOriginalIndex] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);

  const questions = useMemo(
    () =>
      deterministicShuffle(
        rawQuestions.filter(isRunnableQuestion),
        `quiz:${quizId}:attempt:${attemptNonce}`,
      ),
    [rawQuestions, quizId, attemptNonce],
  );
  const current = questions[index];
  const presented = useMemo<PresentedQuestion | null>(() => {
    if (!current) return null;
    const feedback = parseGoldenQuizFeedback(current.explanation, current.options.length);
    const options = current.options.map<PresentedOption>((text, originalIndex) => ({
      originalIndex,
      text,
      translation: feedback.optionTranslations?.[originalIndex],
      rationale: feedback.optionRationales[originalIndex] ?? "",
      correct: originalIndex === current.correctIndex,
    }));
    return {
      question: current,
      feedback,
      options: deterministicShuffle(options, `options:${current.id}:attempt:${attemptNonce}`),
    };
  }, [current, attemptNonce]);
  const selectedOption = presented?.options.find(
    (option) => option.originalIndex === selectedOriginalIndex,
  );
  const answered = selectedOriginalIndex !== null;
  const answeredCorrectly = selectedOption?.correct === true;
  const hasTranslations = questions.some((question) =>
    hasQuizTranslation(parseGoldenQuizFeedback(question.explanation, question.options.length)),
  );

  if (!quiz) {
    return (
      <div className="mx-auto max-w-4xl">
        <Button variant="ghost" onClick={() => navigate({ to: "/app/quizzes" })}>
          <ArrowLeft className="h-4 w-4 me-1" />
          {isRu ? "К тестам" : "Back to quizzes"}
        </Button>
        <div className="mt-5 rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          {isRu ? "Квиз удалён или не найден" : "The quiz was deleted or could not be found"}
        </div>
      </div>
    );
  }

  if (view === "editor") {
    return (
      <div>
        <div className="mx-auto mb-4 flex max-w-[1440px] justify-end">
          <Button variant="outline" onClick={() => setView("trainer")}>
            <GraduationCap className="h-4 w-4 me-1" />
            {isRu ? "Вернуться к тренажёру" : "Back to trainer"}
          </Button>
        </div>
        <QuizStudio quizId={quizId} />
      </div>
    );
  }

  const restart = () => {
    setAttemptNonce((value) => value + 1);
    setIndex(0);
    setSelectedOriginalIndex(null);
    setScore(0);
    setFinished(false);
  };

  const next = () => {
    if (!presented || !answered) return;
    if (index >= questions.length - 1) {
      const finalScore = score + (answeredCorrectly ? 1 : 0);
      store.recordAttempt({
        quizId,
        score: Math.round((finalScore / questions.length) * 100),
        correctCount: finalScore,
        total: questions.length,
      });
      setScore(finalScore);
      setFinished(true);
      return;
    }
    if (answeredCorrectly) setScore((value) => value + 1);
    setIndex((value) => value + 1);
    setSelectedOriginalIndex(null);
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => navigate({ to: "/app/quizzes" })}>
          <ArrowLeft className="h-4 w-4 me-1" />
          {isRu ? "К тестам" : "Back to quizzes"}
        </Button>
        <div className="flex flex-wrap gap-2">
          <AIGenerateButton kind="quiz" />
          <Button variant="outline" onClick={() => setView("editor")}>
            <Settings2 className="h-4 w-4 me-1" />
            {isRu ? "Редактор вопросов" : "Question editor"}
          </Button>
        </div>
      </div>

      <header className="mt-4 rounded-2xl border border-border bg-surface p-5 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              {isRu ? "Интерактивный квиз" : "Interactive quiz"}
            </div>
            <h1 dir="auto" className="mt-2 font-serif text-3xl font-semibold">
              {quiz.title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {isRu
                ? "Четыре правдоподобных варианта, мгновенная проверка, объяснение каждого ответа и подсказка для запоминания."
                : "Four plausible options, immediate checking, a rationale for every answer, and a memory hint."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {hasTranslations && (
              <Button
                variant={showTranslation ? "default" : "outline"}
                onClick={() => setShowTranslation((value) => !value)}
              >
                <Languages className="h-4 w-4 me-1" />
                {showTranslation
                  ? isRu
                    ? "Показан перевод"
                    : "Translation shown"
                  : isRu
                    ? "Показать перевод"
                    : "Show translation"}
              </Button>
            )}
            <Button variant="outline" onClick={restart} disabled={questions.length === 0}>
              <Shuffle className="h-4 w-4 me-1" />
              {isRu ? "Перемешать" : "Shuffle"}
            </Button>
          </div>
        </div>
      </header>

      {questions.length === 0 ? (
        <section className="mt-5 rounded-2xl border border-dashed border-border p-12 text-center">
          <GraduationCap className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-4 font-serif text-xl font-semibold">
            {rawQuestions.length === 0
              ? isRu
                ? "В квизе пока нет вопросов"
                : "This quiz has no questions yet"
              : isRu
                ? "Вопросы нужно исправить перед запуском"
                : "Questions need fixing before the quiz can run"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {isRu
              ? "Открой редактор и проверь формулировки, варианты и правильные ответы."
              : "Open the editor and check prompts, options, and correct answers."}
          </p>
          <Button className="mt-5" onClick={() => setView("editor")}>
            <Settings2 className="h-4 w-4 me-1" />
            {isRu ? "Открыть редактор" : "Open editor"}
          </Button>
        </section>
      ) : finished ? (
        <QuizResult
          correct={score}
          total={questions.length}
          isRu={isRu}
          onRestart={restart}
          onEdit={() => setView("editor")}
        />
      ) : presented ? (
        <section className="mt-5">
          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>
              {isRu ? "Вопрос" : "Question"} {index + 1} / {questions.length}
            </span>
            <span>
              {score} {isRu ? "правильно" : "correct"}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-[width] duration-300"
              style={{ width: `${((index + 1) / questions.length) * 100}%` }}
            />
          </div>

          <article className="mt-4 rounded-2xl border border-border bg-surface p-5 md:p-7">
            <h2 dir="auto" className="font-serif text-2xl font-semibold leading-10">
              {presented.question.prompt}
            </h2>
            {showTranslation && presented.feedback.promptTranslation && (
              <p
                dir="auto"
                className="mt-3 rounded-lg border border-border bg-background p-3 text-sm text-muted-foreground"
              >
                {presented.feedback.promptTranslation}
              </p>
            )}

            <div className="mt-6 space-y-3">
              {presented.options.map((option, optionIndex) => {
                const selected = selectedOriginalIndex === option.originalIndex;
                const stateClass = answered
                  ? option.correct
                    ? "border-emerald-500/60 bg-emerald-500/10"
                    : selected
                      ? "border-red-500/60 bg-red-500/10"
                      : "border-border bg-background"
                  : "border-border bg-background hover:border-primary/60 hover:bg-accent/40";
                return (
                  <div key={option.originalIndex} className={`rounded-xl border ${stateClass}`}>
                    <button
                      type="button"
                      disabled={answered}
                      className="flex w-full items-start gap-3 p-4 text-start disabled:cursor-default"
                      onClick={() => setSelectedOriginalIndex(option.originalIndex)}
                    >
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-current text-xs font-semibold">
                        {String.fromCharCode(65 + optionIndex)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span dir="auto" className="block text-sm leading-6">
                          {option.text}
                        </span>
                        {showTranslation && option.translation && (
                          <span
                            dir="auto"
                            className="mt-1 block text-xs leading-5 text-muted-foreground"
                          >
                            {option.translation}
                          </span>
                        )}
                      </span>
                      {answered && option.correct && (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" />
                      )}
                      {answered && selected && !option.correct && (
                        <XCircle className="h-5 w-5 shrink-0 text-red-300" />
                      )}
                    </button>
                    {answered && option.rationale && (
                      <p
                        dir="auto"
                        className="border-t border-current/10 px-4 py-3 text-xs leading-5 text-muted-foreground"
                      >
                        {option.rationale}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {answered && (
              <div
                className={`mt-6 rounded-xl border p-4 ${
                  answeredCorrectly
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-red-500/30 bg-red-500/5"
                }`}
              >
                <div className="flex items-center gap-2 font-semibold">
                  {answeredCorrectly ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-300" />
                  )}
                  {answeredCorrectly
                    ? isRu
                      ? "Правильно"
                      : "Correct"
                    : isRu
                      ? "Неправильно"
                      : "Incorrect"}
                </div>
                {!answeredCorrectly && (
                  <p dir="auto" className="mt-2 text-sm">
                    <strong>{isRu ? "Правильный ответ:" : "Correct answer:"}</strong>{" "}
                    {presented.question.options[presented.question.correctIndex]}
                  </p>
                )}
                {presented.feedback.correctExplanation && (
                  <p dir="auto" className="mt-3 text-sm leading-6 text-muted-foreground">
                    {presented.feedback.correctExplanation}
                  </p>
                )}
                {presented.feedback.memoryHint && (
                  <div className="mt-3 rounded-lg border border-border bg-background p-3 text-sm leading-6">
                    <strong>{isRu ? "Как запомнить:" : "Memory hint:"}</strong>{" "}
                    <span dir="auto">{presented.feedback.memoryHint}</span>
                  </div>
                )}
                {(presented.question.sourceChunkIds?.length ?? 0) > 0 && (
                  <p className="mt-3 text-[10px] text-muted-foreground">
                    {presented.question.sourceChunkIds?.length}{" "}
                    {isRu ? "фрагм. источника" : "source chunks"}
                  </p>
                )}
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <Button disabled={!answered} onClick={next}>
                {index >= questions.length - 1
                  ? isRu
                    ? "Завершить квиз"
                    : "Finish quiz"
                  : isRu
                    ? "Следующий вопрос"
                    : "Next question"}
                <ChevronRight className="h-4 w-4 ms-1" />
              </Button>
            </div>
          </article>

          {quiz.materialId && (
            <div className="mt-3 text-center text-xs text-muted-foreground">
              <Link
                to="/app/materials/$materialId"
                params={{ materialId: quiz.materialId }}
                className="hover:text-primary hover:underline"
              >
                {isRu ? "Открыть исходный материал" : "Open source material"}
              </Link>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}

function QuizResult({
  correct,
  total,
  isRu,
  onRestart,
  onEdit,
}: {
  correct: number;
  total: number;
  isRu: boolean;
  onRestart: () => void;
  onEdit: () => void;
}) {
  const percent = total ? Math.round((correct / total) * 100) : 0;
  return (
    <section className="mt-5 rounded-2xl border border-border bg-surface p-8 text-center md:p-12">
      <GraduationCap className="mx-auto h-12 w-12 text-primary" />
      <div className="mt-4 text-xs uppercase tracking-[0.18em] text-muted-foreground">
        {isRu ? "Результат" : "Result"}
      </div>
      <div className="mt-2 text-6xl font-bold">{percent}%</div>
      <p className="mt-3 text-sm text-muted-foreground">
        {correct} / {total} {isRu ? "правильных ответов" : "correct answers"}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button onClick={onRestart}>
          <RotateCcw className="h-4 w-4 me-1" />
          {isRu ? "Пройти ещё раз" : "Try again"}
        </Button>
        <Button variant="outline" onClick={onEdit}>
          <Settings2 className="h-4 w-4 me-1" />
          {isRu ? "Редактор вопросов" : "Question editor"}
        </Button>
      </div>
    </section>
  );
}

function isRunnableQuestion(question: QuizQuestion): boolean {
  return (
    Boolean(question.prompt.trim()) &&
    question.options.length >= 2 &&
    question.options.every((option) => Boolean(option.trim())) &&
    Number.isInteger(question.correctIndex) &&
    question.correctIndex >= 0 &&
    question.correctIndex < question.options.length
  );
}

function deterministicShuffle<T>(values: T[], seedText: string): T[] {
  const result = values.slice();
  let state = hash(seedText) || 1;
  for (let index = result.length - 1; index > 0; index -= 1) {
    state = xorshift(state);
    const target = Math.abs(state) % (index + 1);
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result | 0;
}

function xorshift(value: number): number {
  let next = value | 0;
  next ^= next << 13;
  next ^= next >>> 17;
  next ^= next << 5;
  return next | 0;
}
