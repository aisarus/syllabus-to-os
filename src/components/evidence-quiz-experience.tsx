import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  CheckCircle2,
  GraduationCap,
  Languages,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Shuffle,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useMemo, useState, type MouseEvent } from "react";
import { toast } from "sonner";
import { AIGenerateButton } from "@/components/ai-generate-dialog";
import { parseGoldenQuizFeedback, hasQuizTranslation } from "@/lib/golden-quiz";
import { validateQuestion } from "@/components/quiz-library";
import { QuizStudio } from "@/components/quiz-studio";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/app-context";
import {
  recordQuizAttemptWithAnswers,
  useQuizAttemptDetailData,
  type RecordedQuizAttempt,
} from "@/lib/quiz-attempt-details";
import { useData, type QuizQuestion } from "@/lib/store";

interface PresentedOption {
  originalIndex: number;
  text: string;
  translation?: string;
  rationale: string;
  correct: boolean;
}

export function EvidenceQuizExperience({ quizId }: { quizId: string }) {
  const { lang } = useApp();
  const isRu = lang === "ru";
  const data = useData();
  const detailData = useQuizAttemptDetailData();
  const navigate = useNavigate();
  const quiz = data.quizzes.find((item) => item.id === quizId);
  const rawQuestions = data.quizQuestions.filter((question) => question.quizId === quizId);
  const [view, setView] = useState<"trainer" | "editor">("trainer");
  const [attemptNonce, setAttemptNonce] = useState(1);
  const [index, setIndex] = useState(0);
  const [selectedOriginalIndex, setSelectedOriginalIndex] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [recorded, setRecorded] = useState<RecordedQuizAttempt | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);

  const questions = useMemo(
    () =>
      deterministicShuffle(
        rawQuestions.filter((question) => validateQuestion(question).valid),
        `evidence-quiz:${quizId}:${attemptNonce}`,
      ),
    [rawQuestions, quizId, attemptNonce],
  );
  const current = questions[index];
  const feedback = current
    ? parseGoldenQuizFeedback(current.explanation, current.options.length)
    : null;
  const presentedOptions = useMemo<PresentedOption[]>(() => {
    if (!current || !feedback) return [];
    return deterministicShuffle(
      current.options.map((text, originalIndex) => ({
        originalIndex,
        text,
        translation: feedback.optionTranslations?.[originalIndex],
        rationale: feedback.optionRationales[originalIndex] ?? "",
        correct: originalIndex === current.correctIndex,
      })),
      `evidence-options:${current.id}:${attemptNonce}`,
    );
  }, [current, feedback, attemptNonce]);
  const selectedOption = presentedOptions.find(
    (option) => option.originalIndex === selectedOriginalIndex,
  );
  const answered = selectedOriginalIndex !== null;
  const answeredCorrectly = selectedOption?.correct === true;
  const hasTranslations = questions.some((question) =>
    hasQuizTranslation(parseGoldenQuizFeedback(question.explanation, question.options.length)),
  );
  const detailedAttempts = detailData.attempts.filter((attempt) => attempt.quizId === quizId);

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

  const restart = () => {
    setAttemptNonce((value) => value + 1);
    setIndex(0);
    setSelectedOriginalIndex(null);
    setAnswers({});
    setRecorded(null);
  };

  const next = () => {
    if (!current || selectedOriginalIndex === null) return;
    const nextAnswers = { ...answers, [current.id]: selectedOriginalIndex };
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
        if (!result.persistenceOk) {
          toast.error(
            isRu
              ? `Попытка есть в памяти, но core snapshot не подтверждён: ${result.error ?? "ошибка сохранения"}`
              : `The attempt exists in memory, but core persistence was not verified: ${result.error ?? "save error"}`,
          );
        } else {
          toast.success(
            isRu
              ? "Попытка и ответы по каждому вопросу сохранены"
              : "Attempt and per-question answers saved",
          );
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error));
      }
      return;
    }
    setAnswers(nextAnswers);
    setIndex((value) => value + 1);
    setSelectedOriginalIndex(null);
  };

  const blockLegacyRunner = (event: MouseEvent<HTMLDivElement>) => {
    const button = (event.target as HTMLElement).closest("button");
    if (!button) return;
    const label = button.textContent?.trim().toLowerCase() ?? "";
    if (["практика", "экзамен", "practice", "exam"].includes(label)) {
      event.preventDefault();
      event.stopPropagation();
      toast.info(
        isRu
          ? "Запускай тест через evidence-aware тренажёр: только он сохраняет ответы по вопросам."
          : "Run the quiz through the evidence-aware trainer so every question answer is preserved.",
      );
    }
  };

  if (view === "editor") {
    return (
      <div>
        <div className="mx-auto mb-4 flex max-w-[1440px] items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {isRu
              ? "Редактор меняет банк вопросов. Запуск доступен только через evidence-aware тренажёр."
              : "The editor changes the question bank. Attempts run only through the evidence-aware trainer."}
          </p>
          <Button variant="outline" onClick={() => setView("trainer")}>
            <GraduationCap className="h-4 w-4 me-1" />
            {isRu ? "Вернуться к тренажёру" : "Back to trainer"}
          </Button>
        </div>
        <style>{`
          .evidence-editor-only > div > div:first-child > div > button:nth-child(1),
          .evidence-editor-only > div > div:first-child > div > button:nth-child(2) { display: none; }
        `}</style>
        <div className="evidence-editor-only" onClickCapture={blockLegacyRunner}>
          <QuizStudio quizId={quizId} />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => navigate({ to: "/app/quizzes" })}>
          <ArrowLeft className="h-4 w-4 me-1" />
          {isRu ? "К тестам" : "Back to quizzes"}
        </Button>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/app/quiz-quality/$quizId"
            params={{ quizId }}
            className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm hover:bg-accent"
          >
            <ShieldCheck className="h-4 w-4 me-1" />
            {isRu ? "Проверить качество" : "Quality review"}
          </Link>
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
              {isRu ? "Evidence-aware квиз" : "Evidence-aware quiz"}
            </div>
            <h1 dir="auto" className="mt-2 font-serif text-3xl font-semibold">
              {quiz.title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {isRu
                ? "Каждый ответ сохраняется как неизменяемый снимок. Связанное понятие получает recognition evidence только по конкретному вопросу."
                : "Every answer is saved as an immutable snapshot. A linked concept receives recognition evidence only from that exact question."}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {detailedAttempts.length}{" "}
              {isRu ? "попыток с полными ответами" : "attempts with full answer history"}
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
              {isRu ? "Новая попытка" : "New attempt"}
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
          <Button className="mt-5" onClick={() => setView("editor")}>
            <Settings2 className="h-4 w-4 me-1" />
            {isRu ? "Открыть редактор" : "Open editor"}
          </Button>
        </section>
      ) : recorded ? (
        <EvidenceQuizResult recorded={recorded} isRu={isRu} onRestart={restart} />
      ) : current && feedback ? (
        <section className="mt-5">
          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>
              {isRu ? "Вопрос" : "Question"} {index + 1} / {questions.length}
            </span>
            <span>
              {Object.values(answers).length}{" "}
              {isRu ? "ответов сохранено в черновике" : "answers in draft"}
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
              {current.prompt}
            </h2>
            {showTranslation && feedback.promptTranslation && (
              <p
                dir="auto"
                className="mt-3 rounded-lg border border-border bg-background p-3 text-sm text-muted-foreground"
              >
                {feedback.promptTranslation}
              </p>
            )}
            <div className="mt-6 space-y-3">
              {presentedOptions.map((option, optionIndex) => {
                const selected = selectedOriginalIndex === option.originalIndex;
                const stateClass = answered
                  ? option.correct
                    ? "border-emerald-500/60 bg-emerald-500/10"
                    : selected
                      ? "border-red-500/60 bg-red-500/10"
                      : "border-border bg-background"
                  : "border-border bg-background hover:border-primary/60 hover:bg-accent/40";
                return (
                  <button
                    key={option.originalIndex}
                    type="button"
                    disabled={answered}
                    className={`flex w-full items-start gap-3 rounded-xl border p-4 text-start disabled:cursor-default ${stateClass}`}
                    onClick={() => setSelectedOriginalIndex(option.originalIndex)}
                  >
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-current text-xs font-semibold">
                      {String.fromCharCode(65 + optionIndex)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong dir="auto" className="block font-medium">
                        {option.text}
                      </strong>
                      {showTranslation && option.translation && (
                        <span dir="auto" className="mt-1 block text-xs text-muted-foreground">
                          {option.translation}
                        </span>
                      )}
                      {answered && (selected || option.correct) && option.rationale && (
                        <span
                          dir="auto"
                          className="mt-2 block text-xs leading-5 text-muted-foreground"
                        >
                          {option.rationale}
                        </span>
                      )}
                    </span>
                    {answered && option.correct && (
                      <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                    )}
                    {answered && selected && !option.correct && (
                      <XCircle className="h-5 w-5 text-red-300" />
                    )}
                  </button>
                );
              })}
            </div>

            {answered && (
              <div
                className={`mt-5 rounded-xl border p-4 ${answeredCorrectly ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"}`}
              >
                <strong>
                  {answeredCorrectly
                    ? isRu
                      ? "Верно"
                      : "Correct"
                    : isRu
                      ? "Неверно"
                      : "Incorrect"}
                </strong>
                {feedback.memoryHint && (
                  <p dir="auto" className="mt-2 text-sm text-muted-foreground">
                    {feedback.memoryHint}
                  </p>
                )}
              </div>
            )}

            <div className="mt-5 flex justify-end">
              <Button onClick={next} disabled={!answered}>
                {index >= questions.length - 1
                  ? isRu
                    ? "Сохранить попытку"
                    : "Save attempt"
                  : isRu
                    ? "Следующий вопрос"
                    : "Next question"}
              </Button>
            </div>
          </article>
        </section>
      ) : null}
    </div>
  );
}

function EvidenceQuizResult({
  recorded,
  isRu,
  onRestart,
}: {
  recorded: RecordedQuizAttempt;
  isRu: boolean;
  onRestart: () => void;
}) {
  return (
    <section className="mt-5 rounded-2xl border border-border bg-surface p-6 text-center">
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
      <Button className="mt-5" onClick={onRestart}>
        <RotateCcw className="h-4 w-4 me-1" />
        {isRu ? "Пройти ещё раз" : "Try again"}
      </Button>
    </section>
  );
}

function deterministicShuffle<T>(items: T[], seed: string): T[] {
  const output = items.slice();
  let state = hashSeed(seed);
  for (let index = output.length - 1; index > 0; index -= 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const target = state % (index + 1);
    [output[index], output[target]] = [output[target], output[index]];
  }
  return output;
}

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
