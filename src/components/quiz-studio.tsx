import { Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookOpenCheck,
  Check,
  CheckCircle2,
  ExternalLink,
  FileQuestion,
  GitMerge,
  GraduationCap,
  Plus,
  RotateCcw,
  Trash2,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/lib/app-context";
import { validateQuestion } from "@/components/quiz-library";
import {
  store,
  useData,
  type Quiz,
  type QuizQuestion,
} from "@/lib/store";

interface AttemptResult {
  correct: number;
  total: number;
  score: number;
  mode: "practice" | "exam";
}

interface QuestionDuplicateGroup {
  id: string;
  kind: "exact" | "likely";
  questionIds: string[];
  confidence: number;
}

export function QuizStudio({ quizId }: { quizId: string }) {
  const { lang } = useApp();
  const isRu = lang === "ru";
  const data = useData();
  const navigate = useNavigate();
  const quiz = data.quizzes.find((item) => item.id === quizId);

  if (!quiz) {
    return (
      <div className="mx-auto max-w-5xl">
        <Button variant="ghost" onClick={() => navigate({ to: "/app/quizzes" })}>
          <ArrowLeft className="h-4 w-4 me-1" />
          {isRu ? "К тестам" : "Back to quizzes"}
        </Button>
        <div className="mt-4 rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          {isRu ? "Тест удалён или не найден" : "The quiz was deleted or could not be found"}
        </div>
      </div>
    );
  }

  return <ExistingQuizStudio key={quiz.id} quiz={quiz} />;
}

function ExistingQuizStudio({ quiz }: { quiz: Quiz }) {
  const { lang } = useApp();
  const isRu = lang === "ru";
  const data = useData();
  const navigate = useNavigate();
  const rawQuestions = data.quizQuestions.filter((question) => question.quizId === quiz.id);
  const [order, setOrder] = useState<string[]>(() => readQuestionOrder(quiz.id));
  const [mode, setMode] = useState<"edit" | "practice" | "exam" | "result">("edit");
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [duplicateGroup, setDuplicateGroup] = useState<QuestionDuplicateGroup | null>(null);

  useEffect(() => {
    setOrder((current) => {
      const validIds = new Set(rawQuestions.map((question) => question.id));
      const next = [
        ...current.filter((id) => validIds.has(id)),
        ...rawQuestions.map((question) => question.id).filter((id) => !current.includes(id)),
      ];
      writeQuestionOrder(quiz.id, next);
      return arraysEqual(current, next) ? current : next;
    });
  }, [quiz.id, rawQuestions.length]);

  const questions = useMemo(() => {
    const position = new Map(order.map((id, index) => [id, index]));
    return rawQuestions
      .slice()
      .sort((a, b) => (position.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (position.get(b.id) ?? Number.MAX_SAFE_INTEGER));
  }, [rawQuestions, order]);
  const validation = new Map(questions.map((question) => [question.id, validateQuestion(question)]));
  const invalidQuestions = questions.filter((question) => !validation.get(question.id)?.valid);
  const duplicateGroups = useMemo(() => detectQuestionDuplicates(questions), [questions]);
  const attempts = data.quizAttempts.filter((attempt) => attempt.quizId === quiz.id);
  const topics = data.topics.filter((topic) => !quiz.courseId || topic.courseId === quiz.courseId);
  const materials = data.materials.filter(
    (material) => !quiz.courseId || !material.courseId || material.courseId === quiz.courseId,
  );
  const canRun = questions.length > 0 && invalidQuestions.length === 0;

  const moveQuestion = (questionId: string, direction: -1 | 1) => {
    const index = questions.findIndex((question) => question.id === questionId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= questions.length) return;
    const next = questions.map((question) => question.id);
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
    writeQuestionOrder(quiz.id, next);
  };

  const addQuestion = () => {
    const question = store.addQuestion({
      quizId: quiz.id,
      prompt: "",
      options: ["", "", "", ""],
      correctIndex: 0,
      explanation: "",
      sourceChunkIds: [],
    });
    const next = [...questions.map((item) => item.id), question.id];
    setOrder(next);
    writeQuestionOrder(quiz.id, next);
    requestAnimationFrame(() => document.getElementById(`question-${question.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  };

  const deleteQuestion = (questionId: string) => {
    const confirmed = confirm(isRu ? "Удалить этот вопрос?" : "Delete this question?");
    if (!confirmed) return;
    store.deleteQuestion(questionId);
    const next = order.filter((id) => id !== questionId);
    setOrder(next);
    writeQuestionOrder(quiz.id, next);
  };

  const startMode = (nextMode: "practice" | "exam") => {
    if (!canRun) {
      toast.error(
        invalidQuestions.length > 0
          ? isRu
            ? "Сначала исправь невалидные вопросы"
            : "Fix invalid questions first"
          : isRu
            ? "Добавь хотя бы один вопрос"
            : "Add at least one question",
      );
      return;
    }
    setAnswers({});
    setResult(null);
    setMode(nextMode);
  };

  const finishAttempt = (attemptAnswers: Record<string, number>, runMode: "practice" | "exam") => {
    const correct = questions.reduce(
      (sum, question) => sum + (attemptAnswers[question.id] === question.correctIndex ? 1 : 0),
      0,
    );
    const total = questions.length;
    const score = total ? Math.round((correct / total) * 100) : 0;
    store.recordAttempt({ quizId: quiz.id, score, correctCount: correct, total });
    setAnswers(attemptAnswers);
    setResult({ correct, total, score, mode: runMode });
    setMode("result");
  };

  return (
    <div className="mx-auto max-w-[1440px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => navigate({ to: "/app/quizzes" })}>
          <ArrowLeft className="h-4 w-4 me-1" />
          {isRu ? "К тестам" : "Back to quizzes"}
        </Button>
        <div className="flex flex-wrap gap-2">
          {mode === "edit" ? (
            <>
              <Button
                variant="outline"
                onClick={() => startMode("practice")}
                disabled={!canRun}
                title={!canRun ? (isRu ? "Исправь вопросы перед запуском" : "Fix questions before starting") : undefined}
              >
                <BookOpenCheck className="h-4 w-4 me-1" />
                {isRu ? "Практика" : "Practice"}
              </Button>
              <Button
                onClick={() => startMode("exam")}
                disabled={!canRun}
                title={!canRun ? (isRu ? "Исправь вопросы перед запуском" : "Fix questions before starting") : undefined}
              >
                <GraduationCap className="h-4 w-4 me-1" />
                {isRu ? "Экзамен" : "Exam"}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setMode("edit")}>
              {isRu ? "Вернуться в редактор" : "Back to editor"}
            </Button>
          )}
          <Button
            variant="destructive"
            onClick={() => {
              const confirmed = confirm(
                isRu
                  ? "Удалить тест, все вопросы и историю попыток?"
                  : "Delete this quiz, all questions, and attempt history?",
              );
              if (!confirmed) return;
              store.deleteQuiz(quiz.id);
              localStorage.removeItem(orderStorageKey(quiz.id));
              navigate({ to: "/app/quizzes" });
            }}
          >
            <Trash2 className="h-4 w-4 me-1" />
            {isRu ? "Удалить тест" : "Delete quiz"}
          </Button>
        </div>
      </div>

      {mode === "edit" && (
        <>
          <header className="mt-4 rounded-xl border border-border bg-surface p-4 md:p-5">
            <Input
              dir="auto"
              value={quiz.title}
              aria-label={isRu ? "Название теста" : "Quiz title"}
              onChange={(event) => store.updateQuiz(quiz.id, { title: event.target.value })}
              className="h-auto border-transparent bg-transparent p-0 font-serif text-3xl font-semibold hover:border-input focus:border-input"
            />
            <div className="mt-4 grid gap-2 md:grid-cols-3">
              <Select
                value={quiz.courseId ?? "_none"}
                onValueChange={(value) =>
                  store.updateQuiz(quiz.id, {
                    courseId: value === "_none" ? undefined : value,
                    topicId: undefined,
                  })
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">{isRu ? "Без курса" : "No course"}</SelectItem>
                  {data.courses.map((course) => <SelectItem key={course.id} value={course.id}>{course.title}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select
                value={quiz.topicId ?? "_none"}
                disabled={!quiz.courseId}
                onValueChange={(value) => store.updateQuiz(quiz.id, { topicId: value === "_none" ? undefined : value })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">{isRu ? "Без темы" : "No topic"}</SelectItem>
                  {topics.map((topic) => <SelectItem key={topic.id} value={topic.id}>{topic.title}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select
                value={quiz.materialId ?? "_none"}
                onValueChange={(value) => store.updateQuiz(quiz.id, { materialId: value === "_none" ? undefined : value })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">{isRu ? "Без материала" : "No material"}</SelectItem>
                  {materials.map((material) => <SelectItem key={material.id} value={material.id}>{material.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <SummaryCell label={isRu ? "Вопросов" : "Questions"} value={questions.length} />
              <SummaryCell label={isRu ? "Невалидных" : "Invalid"} value={invalidQuestions.length} danger={invalidQuestions.length > 0} />
              <SummaryCell label={isRu ? "Дубликатов" : "Duplicate groups"} value={duplicateGroups.length} warning={duplicateGroups.length > 0} />
              <SummaryCell label={isRu ? "Попыток" : "Attempts"} value={attempts.length} />
            </div>
          </header>

          {invalidQuestions.length > 0 && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/5 p-4 text-sm text-red-200">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <strong>{isRu ? "Тест пока нельзя запускать" : "This quiz cannot run yet"}</strong>
                <p className="mt-1 text-xs text-muted-foreground">
                  {isRu
                    ? "Невалидные вопросы остаются в редакторе, но никогда не включаются в практику или экзамен молча."
                    : "Invalid questions remain editable but are never silently included in practice or exam mode."}
                </p>
              </div>
            </div>
          )}

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <main className="min-w-0 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-serif text-xl font-semibold">{isRu ? "Банк вопросов" : "Question bank"}</h2>
                <Button onClick={addQuestion}>
                  <Plus className="h-4 w-4 me-1" />
                  {isRu ? "Добавить вопрос" : "Add question"}
                </Button>
              </div>
              {questions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-10 text-center">
                  <FileQuestion className="mx-auto h-8 w-8 text-muted-foreground" />
                  <strong className="mt-3 block">{isRu ? "Вопросов пока нет" : "No questions yet"}</strong>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {isRu ? "Добавь первый вопрос или сгенерируй тест из материала." : "Add the first question or generate a quiz from source material."}
                  </p>
                </div>
              ) : (
                questions.map((question, index) => (
                  <QuestionEditor
                    key={question.id}
                    question={question}
                    index={index}
                    total={questions.length}
                    quiz={quiz}
                    validation={validation.get(question.id) ?? { valid: false, errors: ["unknown"] }}
                    onMove={moveQuestion}
                    onDelete={deleteQuestion}
                  />
                ))
              )}
            </main>

            <aside className="space-y-4">
              <section className="rounded-xl border border-border bg-surface p-4">
                <h2 className="font-semibold">{isRu ? "Проверка дубликатов" : "Duplicate review"}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {isRu
                    ? "Похожие вопросы не удаляются автоматически. Выбери итоговый вопрос и подтверди объединение."
                    : "Similar questions are never removed automatically. Choose the final question and confirm the merge."}
                </p>
                {duplicateGroups.length === 0 ? (
                  <div className="mt-3 flex items-start gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-200">
                    <CheckCircle2 className="mt-0.5 h-4 w-4" />
                    {isRu ? "Похожих вопросов не найдено." : "No duplicate questions detected."}
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    {duplicateGroups.map((group) => (
                      <button
                        key={group.id}
                        type="button"
                        className="w-full rounded-lg border border-border bg-background p-3 text-start hover:border-primary/50"
                        onClick={() => setDuplicateGroup(group)}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className={`rounded px-2 py-1 text-[10px] uppercase ${group.kind === "exact" ? "bg-red-500/10 text-red-200" : "bg-yellow-500/10 text-yellow-200"}`}>
                            {group.kind === "exact" ? (isRu ? "Точные" : "Exact") : (isRu ? "Вероятные" : "Likely")}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{Math.round(group.confidence * 100)}%</span>
                        </span>
                        <span className="mt-2 block text-xs text-muted-foreground">
                          {group.questionIds.length} {isRu ? "вопроса в группе" : "questions in group"}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-border bg-surface p-4">
                <h2 className="font-semibold">{isRu ? "История попыток" : "Attempt history"}</h2>
                {attempts.length === 0 ? (
                  <p className="mt-3 text-xs text-muted-foreground">{isRu ? "Попыток пока нет." : "No attempts yet."}</p>
                ) : (
                  <div className="mt-3 max-h-80 space-y-2 overflow-auto">
                    {attempts.map((attempt) => (
                      <div key={attempt.id} className="rounded-md border border-border bg-background p-3 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span>{new Date(attempt.takenAt).toLocaleString(isRu ? "ru-RU" : "en-GB")}</span>
                          <strong>{attempt.score}%</strong>
                        </div>
                        <div className="mt-1 text-muted-foreground">{attempt.correctCount}/{attempt.total}</div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </aside>
          </div>
        </>
      )}

      {mode === "practice" && (
        <PracticeRunner
          questions={questions}
          quiz={quiz}
          onComplete={(attemptAnswers) => finishAttempt(attemptAnswers, "practice")}
        />
      )}

      {mode === "exam" && (
        <ExamRunner
          questions={questions}
          quiz={quiz}
          onComplete={(attemptAnswers) => finishAttempt(attemptAnswers, "exam")}
        />
      )}

      {mode === "result" && result && (
        <ResultView
          quiz={quiz}
          questions={questions}
          answers={answers}
          result={result}
          onRetry={() => startMode(result.mode)}
          onEdit={() => setMode("edit")}
        />
      )}

      <DuplicateQuestionDialog
        group={duplicateGroup}
        quizId={quiz.id}
        questionOrder={questions.map((question) => question.id)}
        onOpenChange={(open) => !open && setDuplicateGroup(null)}
        onOrderChange={(next) => {
          setOrder(next);
          writeQuestionOrder(quiz.id, next);
        }}
      />
    </div>
  );
}

function QuestionEditor({
  question,
  index,
  total,
  quiz,
  validation,
  onMove,
  onDelete,
}: {
  question: QuizQuestion;
  index: number;
  total: number;
  quiz: Quiz;
  validation: ReturnType<typeof validateQuestion>;
  onMove: (questionId: string, direction: -1 | 1) => void;
  onDelete: (questionId: string) => void;
}) {
  const { lang } = useApp();
  const isRu = lang === "ru";
  const data = useData();
  const availableChunks = quiz.materialId
    ? data.materialChunks
        .filter((chunk) => chunk.materialId === quiz.materialId)
        .slice()
        .sort((a, b) => a.order - b.order)
    : [];

  const updateOptions = (options: string[], nextCorrectIndex = question.correctIndex) => {
    store.updateQuestion(question.id, {
      options,
      correctIndex: Math.max(0, Math.min(nextCorrectIndex, options.length - 1)),
    });
  };

  return (
    <article id={`question-${question.id}`} className={`rounded-xl border bg-surface p-4 md:p-5 ${validation.valid ? "border-border" : "border-red-500/40"}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded border border-border bg-background text-xs text-muted-foreground">{index + 1}</span>
          {validation.valid ? (
            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-300">
              <CheckCircle2 className="h-3 w-3" />
              {isRu ? "Валиден" : "Valid"}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded bg-red-500/10 px-2 py-1 text-[10px] text-red-200">
              <AlertTriangle className="h-3 w-3" />
              {isRu ? "Нужно исправить" : "Needs fixing"}
            </span>
          )}
        </div>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" disabled={index === 0} aria-label={isRu ? "Поднять вопрос" : "Move question up"} onClick={() => onMove(question.id, -1)}>
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" disabled={index === total - 1} aria-label={isRu ? "Опустить вопрос" : "Move question down"} onClick={() => onMove(question.id, 1)}>
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" aria-label={isRu ? "Удалить вопрос" : "Delete question"} onClick={() => onDelete(question.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-4">
        <Label>{isRu ? "Формулировка" : "Prompt"}</Label>
        <Textarea
          dir="auto"
          className="mt-1 min-h-[100px] resize-y"
          value={question.prompt}
          onChange={(event) => store.updateQuestion(question.id, { prompt: event.target.value })}
        />
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label>{isRu ? "Варианты ответа" : "Answer options"}</Label>
          <Button size="sm" variant="ghost" onClick={() => updateOptions([...question.options, ""])}>
            <Plus className="h-3.5 w-3.5 me-1" />
            {isRu ? "Добавить вариант" : "Add option"}
          </Button>
        </div>
        {question.options.map((option, optionIndex) => (
          <div key={optionIndex} className="flex items-start gap-2">
            <button
              type="button"
              className={`mt-2 grid h-6 w-6 shrink-0 place-items-center rounded-full border ${question.correctIndex === optionIndex ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
              aria-label={isRu ? "Отметить правильным" : "Mark as correct"}
              onClick={() => store.updateQuestion(question.id, { correctIndex: optionIndex })}
            >
              {question.correctIndex === optionIndex && <Check className="h-3.5 w-3.5" />}
            </button>
            <Textarea
              dir="auto"
              className="min-h-[52px] flex-1 resize-y"
              value={option}
              onChange={(event) => updateOptions(question.options.map((item, index) => index === optionIndex ? event.target.value : item))}
            />
            <Button
              size="icon"
              variant="ghost"
              disabled={question.options.length <= 2}
              aria-label={isRu ? "Удалить вариант" : "Delete option"}
              onClick={() => {
                const next = question.options.filter((_, index) => index !== optionIndex);
                const nextCorrect = optionIndex < question.correctIndex
                  ? question.correctIndex - 1
                  : optionIndex === question.correctIndex
                    ? 0
                    : question.correctIndex;
                updateOptions(next, nextCorrect);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <Label>{isRu ? "Объяснение правильного ответа" : "Answer explanation"}</Label>
        <Textarea
          dir="auto"
          className="mt-1 min-h-[90px] resize-y"
          value={question.explanation ?? ""}
          onChange={(event) => store.updateQuestion(question.id, { explanation: event.target.value })}
        />
      </div>

      <details className="mt-4 rounded-lg border border-border bg-background p-3">
        <summary className="cursor-pointer text-sm font-medium">
          {isRu ? "Ссылки на источник" : "Source references"} ({question.sourceChunkIds?.length ?? 0})
        </summary>
        {!quiz.materialId ? (
          <p className="mt-3 text-xs text-muted-foreground">
            {isRu ? "Сначала привяжи тест к материалу." : "Link the quiz to source material first."}
          </p>
        ) : availableChunks.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            {isRu ? "У материала нет извлечённых фрагментов." : "The material has no extracted chunks."}
          </p>
        ) : (
          <div className="mt-3 max-h-64 space-y-1 overflow-auto">
            {availableChunks.map((chunk) => {
              const checked = question.sourceChunkIds?.includes(chunk.id) ?? false;
              return (
                <button
                  key={chunk.id}
                  type="button"
                  className={`w-full rounded border p-2 text-start text-xs ${checked ? "border-primary/50 bg-primary/10" : "border-border hover:bg-accent"}`}
                  onClick={() => store.updateQuestion(question.id, {
                    sourceChunkIds: checked
                      ? (question.sourceChunkIds ?? []).filter((id) => id !== chunk.id)
                      : [...(question.sourceChunkIds ?? []), chunk.id],
                  })}
                >
                  <strong className="block truncate">{chunk.title || `${isRu ? "Фрагмент" : "Chunk"} ${chunk.order + 1}`}</strong>
                  <span className="mt-1 block line-clamp-2 text-muted-foreground">{chunk.text}</span>
                </button>
              );
            })}
          </div>
        )}
      </details>

      {!validation.valid && (
        <div className="mt-4 rounded-md border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-200">
          <strong>{isRu ? "Что исправить" : "Validation errors"}</strong>
          <ul className="mt-1 list-disc space-y-1 ps-5 text-muted-foreground">
            {validation.errors.map((error) => <li key={error}>{validationMessage(error, isRu)}</li>)}
          </ul>
        </div>
      )}
    </article>
  );
}

function PracticeRunner({
  questions,
  quiz,
  onComplete,
}: {
  questions: QuizQuestion[];
  quiz: Quiz;
  onComplete: (answers: Record<string, number>) => void;
}) {
  const { lang } = useApp();
  const isRu = lang === "ru";
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const question = questions[index];
  const chosen = question ? answers[question.id] : undefined;
  const answered = chosen != null;
  const correct = answered && chosen === question.correctIndex;

  return (
    <section className="mx-auto mt-5 max-w-3xl rounded-xl border border-border bg-surface p-4 md:p-6">
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{isRu ? "Практика с мгновенной обратной связью" : "Practice with immediate feedback"}</span>
        <span>{index + 1} / {questions.length}</span>
      </div>
      <h1 dir="auto" className="mt-5 font-serif text-2xl font-semibold leading-9">{question.prompt}</h1>
      <div className="mt-5 space-y-2">
        {question.options.map((option, optionIndex) => {
          const selected = chosen === optionIndex;
          const isCorrectOption = optionIndex === question.correctIndex;
          const feedbackClass = answered
            ? isCorrectOption
              ? "border-emerald-500/50 bg-emerald-500/10"
              : selected
                ? "border-red-500/50 bg-red-500/10"
                : "border-border"
            : selected
              ? "border-primary bg-primary/10"
              : "border-border hover:border-primary/50";
          return (
            <button
              key={optionIndex}
              type="button"
              dir="auto"
              disabled={answered}
              className={`w-full rounded-lg border p-4 text-start text-sm ${feedbackClass}`}
              onClick={() => setAnswers((current) => ({ ...current, [question.id]: optionIndex }))}
            >
              {option}
            </button>
          );
        })}
      </div>
      {answered && (
        <div className={`mt-5 rounded-lg border p-4 ${correct ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"}`}>
          <div className="flex items-center gap-2 font-medium">
            {correct ? <CheckCircle2 className="h-5 w-5 text-emerald-300" /> : <XCircle className="h-5 w-5 text-red-300" />}
            {correct ? (isRu ? "Правильно" : "Correct") : (isRu ? "Неправильно" : "Incorrect")}
          </div>
          {!correct && (
            <p dir="auto" className="mt-2 text-sm">
              {isRu ? "Правильный ответ" : "Correct answer"}: {question.options[question.correctIndex]}
            </p>
          )}
          {question.explanation && <p dir="auto" className="mt-2 text-sm text-muted-foreground">{question.explanation}</p>}
          <SourceReferenceLinks question={question} quiz={quiz} />
        </div>
      )}
      <div className="mt-5 flex justify-end">
        <Button
          disabled={!answered}
          onClick={() => {
            if (index === questions.length - 1) onComplete(answers);
            else setIndex((current) => current + 1);
          }}
        >
          {index === questions.length - 1
            ? isRu ? "Завершить практику" : "Finish practice"
            : isRu ? "Следующий вопрос" : "Next question"}
        </Button>
      </div>
    </section>
  );
}

function ExamRunner({
  questions,
  quiz,
  onComplete,
}: {
  questions: QuizQuestion[];
  quiz: Quiz;
  onComplete: (answers: Record<string, number>) => void;
}) {
  const { lang } = useApp();
  const isRu = lang === "ru";
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const unanswered = questions.filter((question) => answers[question.id] == null).length;

  return (
    <section className="mx-auto mt-5 max-w-4xl">
      <div className="rounded-xl border border-border bg-surface p-4 md:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-serif text-2xl font-semibold">{isRu ? "Экзаменационный режим" : "Exam mode"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isRu
                ? "Ответы, правильные варианты и объяснения появятся только после завершения."
                : "Answers, correct options, and explanations remain hidden until submission."}
            </p>
          </div>
          <span className="rounded border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
            {unanswered} {isRu ? "без ответа" : "unanswered"}
          </span>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {questions.map((question, questionIndex) => (
          <article key={question.id} className="rounded-xl border border-border bg-surface p-4 md:p-5">
            <h2 dir="auto" className="font-medium leading-7">{questionIndex + 1}. {question.prompt}</h2>
            <div className="mt-4 space-y-2">
              {question.options.map((option, optionIndex) => (
                <label key={optionIndex} className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 hover:border-primary/50">
                  <input
                    className="mt-1"
                    type="radio"
                    name={question.id}
                    checked={answers[question.id] === optionIndex}
                    onChange={() => setAnswers((current) => ({ ...current, [question.id]: optionIndex }))}
                  />
                  <span dir="auto" className="text-sm">{option}</span>
                </label>
              ))}
            </div>
            {(question.sourceChunkIds?.length ?? 0) > 0 && (
              <p className="mt-3 text-[10px] text-muted-foreground">
                {isRu ? "Источник прикреплён; откроется после сдачи." : "A source is attached and becomes visible after submission."}
              </p>
            )}
          </article>
        ))}
      </div>
      <div className="sticky bottom-3 mt-4 rounded-xl border border-border bg-surface/95 p-3 backdrop-blur">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-muted-foreground">
            {unanswered === 0
              ? isRu ? "Все вопросы заполнены" : "All questions answered"
              : isRu ? `Осталось ответить: ${unanswered}` : `${unanswered} questions remain`}
          </span>
          <Button disabled={unanswered > 0} onClick={() => onComplete(answers)}>
            <GraduationCap className="h-4 w-4 me-1" />
            {isRu ? "Сдать экзамен" : "Submit exam"}
          </Button>
        </div>
      </div>
    </section>
  );
}

function ResultView({
  quiz,
  questions,
  answers,
  result,
  onRetry,
  onEdit,
}: {
  quiz: Quiz;
  questions: QuizQuestion[];
  answers: Record<string, number>;
  result: AttemptResult;
  onRetry: () => void;
  onEdit: () => void;
}) {
  const { lang } = useApp();
  const isRu = lang === "ru";
  return (
    <section className="mx-auto mt-5 max-w-4xl">
      <div className="rounded-xl border border-border bg-surface p-6 text-center">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          {result.mode === "practice" ? (isRu ? "Результат практики" : "Practice result") : (isRu ? "Результат экзамена" : "Exam result")}
        </div>
        <div className="mt-3 text-6xl font-bold">{result.score}%</div>
        <div className="mt-2 text-sm text-muted-foreground">{result.correct} / {result.total}</div>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button onClick={onRetry}>
            <RotateCcw className="h-4 w-4 me-1" />
            {isRu ? "Пройти ещё раз" : "Retry"}
          </Button>
          <Button variant="outline" onClick={onEdit}>{isRu ? "В редактор" : "Back to editor"}</Button>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {questions.map((question, index) => {
          const chosen = answers[question.id];
          const correct = chosen === question.correctIndex;
          return (
            <article key={question.id} className={`rounded-xl border p-4 md:p-5 ${correct ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"}`}>
              <div className="flex items-start gap-2">
                {correct ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />}
                <div className="min-w-0 flex-1">
                  <h2 dir="auto" className="font-medium leading-7">{index + 1}. {question.prompt}</h2>
                  <p dir="auto" className="mt-2 text-sm">
                    {isRu ? "Твой ответ" : "Your answer"}: {chosen != null ? question.options[chosen] : "—"}
                  </p>
                  {!correct && (
                    <p dir="auto" className="mt-1 text-sm">
                      {isRu ? "Правильный ответ" : "Correct answer"}: {question.options[question.correctIndex]}
                    </p>
                  )}
                  {question.explanation && <p dir="auto" className="mt-3 text-sm text-muted-foreground">{question.explanation}</p>}
                  <SourceReferenceLinks question={question} quiz={quiz} />
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function SourceReferenceLinks({ question, quiz }: { question: QuizQuestion; quiz: Quiz }) {
  const { lang } = useApp();
  const isRu = lang === "ru";
  const data = useData();
  const chunks = (question.sourceChunkIds ?? [])
    .map((id) => data.materialChunks.find((chunk) => chunk.id === id))
    .filter((chunk): chunk is NonNullable<typeof chunk> => Boolean(chunk));
  if (chunks.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {chunks.map((chunk) => {
        const material = data.materials.find((item) => item.id === chunk.materialId) ?? data.materials.find((item) => item.id === quiz.materialId);
        return material ? (
          <Link
            key={chunk.id}
            to="/app/materials/$materialId"
            params={{ materialId: material.id }}
            className="inline-flex max-w-full items-center gap-1 rounded border border-border bg-background px-2 py-1 text-[10px] text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3 shrink-0" />
            <span className="truncate">{chunk.title || `${isRu ? "Фрагмент" : "Chunk"} ${chunk.order + 1}`}</span>
          </Link>
        ) : null;
      })}
    </div>
  );
}

function DuplicateQuestionDialog({
  group,
  quizId,
  questionOrder,
  onOpenChange,
  onOrderChange,
}: {
  group: QuestionDuplicateGroup | null;
  quizId: string;
  questionOrder: string[];
  onOpenChange: (open: boolean) => void;
  onOrderChange: (order: string[]) => void;
}) {
  const { lang } = useApp();
  const isRu = lang === "ru";
  const data = useData();
  const questions = group
    ? group.questionIds
        .map((id) => data.quizQuestions.find((question) => question.id === id))
        .filter((question): question is QuizQuestion => Boolean(question))
    : [];
  const [keeperId, setKeeperId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [options, setOptions] = useState<string[]>([]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [explanation, setExplanation] = useState("");

  const setFromQuestion = (question: QuizQuestion) => {
    setKeeperId(question.id);
    setPrompt(question.prompt);
    setOptions([...question.options]);
    setCorrectIndex(question.correctIndex);
    setExplanation(question.explanation ?? "");
  };

  const handleOpen = (open: boolean) => {
    if (open && questions[0]) setFromQuestion(questions[0]);
    onOpenChange(open);
  };

  const finalValidation = validateQuestion({
    id: keeperId || "preview",
    quizId,
    prompt,
    options,
    correctIndex,
    explanation,
    sourceChunkIds: [],
  });

  const merge = () => {
    const keeper = questions.find((question) => question.id === keeperId);
    if (!keeper || !finalValidation.valid) return;
    const sourceChunkIds = Array.from(new Set(questions.flatMap((question) => question.sourceChunkIds ?? [])));
    store.updateQuestion(keeper.id, {
      prompt: prompt.trim(),
      options: options.map((option) => option.trim()),
      correctIndex,
      explanation: explanation.trim() || undefined,
      sourceChunkIds,
    });
    for (const question of questions) {
      if (question.id !== keeper.id) store.deleteQuestion(question.id);
    }
    const removed = new Set(questions.filter((question) => question.id !== keeper.id).map((question) => question.id));
    const nextOrder = questionOrder.filter((id) => !removed.has(id));
    onOrderChange(nextOrder);
    toast.success(
      isRu
        ? `Оставлен 1 вопрос, удалено ${Math.max(0, questions.length - 1)} дубликатов`
        : `Kept 1 question and removed ${Math.max(0, questions.length - 1)} duplicates`,
    );
    onOpenChange(false);
  };

  return (
    <Dialog open={Boolean(group)} onOpenChange={handleOpen}>
      <DialogContent className="max-w-4xl">
        <DialogHeader><DialogTitle>{isRu ? "Объединение похожих вопросов" : "Merge similar questions"}</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">
          {isRu
            ? "Выбери итоговый вопрос, проверь формулировку и варианты. Ссылки на источники объединятся. Остальные вопросы удалятся только после подтверждения."
            : "Choose the final question and verify its wording and options. Source references are combined. Other questions are deleted only after confirmation."}
        </p>
        <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <div className="max-h-[460px] space-y-2 overflow-auto">
            {questions.map((question) => (
              <button
                key={question.id}
                type="button"
                className={`w-full rounded-lg border p-3 text-start text-xs ${keeperId === question.id ? "border-primary bg-primary/10" : "border-border bg-background"}`}
                onClick={() => setFromQuestion(question)}
              >
                <span className="flex items-start gap-2">
                  <input type="radio" readOnly checked={keeperId === question.id} />
                  <strong dir="auto" className="line-clamp-3">{question.prompt}</strong>
                </span>
                <span className="mt-2 block text-[10px] text-muted-foreground">
                  {question.options.length} {isRu ? "вариантов" : "options"} · {question.sourceChunkIds?.length ?? 0} {isRu ? "источн." : "sources"}
                </span>
              </button>
            ))}
          </div>
          <div className="space-y-3">
            <div>
              <Label>{isRu ? "Итоговая формулировка" : "Final prompt"}</Label>
              <Textarea dir="auto" className="mt-1 min-h-[100px]" value={prompt} onChange={(event) => setPrompt(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{isRu ? "Варианты" : "Options"}</Label>
              {options.map((option, index) => (
                <div key={index} className="flex items-start gap-2">
                  <button
                    type="button"
                    className={`mt-2 grid h-6 w-6 shrink-0 place-items-center rounded-full border ${correctIndex === index ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
                    onClick={() => setCorrectIndex(index)}
                  >
                    {correctIndex === index && <Check className="h-3.5 w-3.5" />}
                  </button>
                  <Textarea dir="auto" className="min-h-[48px]" value={option} onChange={(event) => setOptions((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} />
                </div>
              ))}
            </div>
            <div>
              <Label>{isRu ? "Объяснение" : "Explanation"}</Label>
              <Textarea dir="auto" className="mt-1 min-h-[90px]" value={explanation} onChange={(event) => setExplanation(event.target.value)} />
            </div>
          </div>
        </div>
        {!finalValidation.valid && (
          <div className="rounded-md border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-200">
            {isRu ? "Итоговый вопрос пока невалиден." : "The final question is still invalid."}
          </div>
        )}
        <div className="rounded-md border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-200">
          {isRu
            ? `После подтверждения будет удалено ${Math.max(0, questions.length - 1)} вопросов. Отменить действие нельзя.`
            : `${Math.max(0, questions.length - 1)} questions will be deleted after confirmation. This cannot be undone.`}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{isRu ? "Отмена" : "Cancel"}</Button>
          <Button variant="destructive" disabled={!finalValidation.valid} onClick={merge}>
            <GitMerge className="h-4 w-4 me-1" />
            {isRu ? "Объединить и удалить дубликаты" : "Merge and remove duplicates"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryCell({
  label,
  value,
  danger = false,
  warning = false,
}: {
  label: string;
  value: number;
  danger?: boolean;
  warning?: boolean;
}) {
  return (
    <div className={`rounded-md border p-3 ${danger ? "border-red-500/30 bg-red-500/5" : warning ? "border-yellow-500/30 bg-yellow-500/5" : "border-border bg-background"}`}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}

function validationMessage(error: string, isRu: boolean): string {
  const messages: Record<string, [string, string]> = {
    prompt: ["Нет формулировки вопроса", "Question prompt is empty"],
    options_count: ["Нужно минимум два варианта", "At least two options are required"],
    empty_option: ["Есть пустой вариант ответа", "One or more options are empty"],
    duplicate_options: ["Варианты ответа повторяются", "Answer options contain duplicates"],
    correct_index: ["Не выбран корректный правильный ответ", "Correct answer selection is invalid"],
    unknown: ["Неизвестная ошибка проверки", "Unknown validation error"],
  };
  return messages[error]?.[isRu ? 0 : 1] ?? error;
}

function detectQuestionDuplicates(questions: QuizQuestion[]): QuestionDuplicateGroup[] {
  const candidates = questions.filter((question) => question.prompt.trim());
  const parent = new Map(candidates.map((question) => [question.id, question.id]));
  const edges = new Map<string, { kind: "exact" | "likely"; score: number }>();

  const find = (id: string): string => {
    const value = parent.get(id) ?? id;
    if (value === id) return id;
    const root = find(value);
    parent.set(id, root);
    return root;
  };
  const union = (left: string, right: string) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parent.set(rightRoot, leftRoot);
  };

  for (let leftIndex = 0; leftIndex < candidates.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < candidates.length; rightIndex += 1) {
      const left = candidates[leftIndex];
      const right = candidates[rightIndex];
      const exact = questionKey(left) === questionKey(right);
      const score = exact ? 1 : questionSimilarity(left, right);
      if (!exact && score < 0.78) continue;
      edges.set(pairKey(left.id, right.id), { kind: exact ? "exact" : "likely", score });
      union(left.id, right.id);
    }
  }

  const grouped = new Map<string, string[]>();
  for (const question of candidates) {
    const root = find(question.id);
    grouped.set(root, [...(grouped.get(root) ?? []), question.id]);
  }

  return Array.from(grouped.values())
    .filter((ids) => ids.length > 1)
    .map((ids) => {
      const groupEdges: Array<{ kind: "exact" | "likely"; score: number }> = [];
      for (let leftIndex = 0; leftIndex < ids.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < ids.length; rightIndex += 1) {
          const edge = edges.get(pairKey(ids[leftIndex], ids[rightIndex]));
          if (edge) groupEdges.push(edge);
        }
      }
      const kind = groupEdges.length > 0 && groupEdges.every((edge) => edge.kind === "exact") ? "exact" : "likely";
      const confidence = groupEdges.length
        ? groupEdges.reduce((sum, edge) => sum + edge.score, 0) / groupEdges.length
        : 0.78;
      return {
        id: `qdup_${ids.slice().sort().join("_")}`,
        kind,
        questionIds: ids,
        confidence,
      } satisfies QuestionDuplicateGroup;
    })
    .sort((left, right) => left.kind === right.kind ? right.confidence - left.confidence : left.kind === "exact" ? -1 : 1);
}

function questionSimilarity(left: QuizQuestion, right: QuizQuestion): number {
  const prompt = tokenSimilarity(left.prompt, right.prompt);
  const leftOptions = normalizeText(left.options.join(" "));
  const rightOptions = normalizeText(right.options.join(" "));
  const options = tokenSimilarity(leftOptions, rightOptions);
  return prompt * 0.78 + options * 0.22;
}

function questionKey(question: QuizQuestion): string {
  return `${normalizeText(question.prompt)}::${question.options.map(normalizeText).sort().join("|")}`;
}

function tokenSimilarity(leftValue: string, rightValue: string): number {
  const left = new Set(normalizeText(leftValue).split(" ").filter(Boolean));
  const right = new Set(normalizeText(rightValue).split(" ").filter(Boolean));
  if (left.size === 0 || right.size === 0) return 0;
  const intersection = Array.from(left).filter((token) => right.has(token)).length;
  const union = new Set([...left, ...right]).size;
  return union ? intersection / union : 0;
}

function normalizeText(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u0591-\u05c7]/g, "")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pairKey(left: string, right: string): string {
  return [left, right].sort().join("::");
}

function orderStorageKey(quizId: string): string {
  return `lamdan.quiz-question-order.${quizId}`;
}

function readQuestionOrder(quizId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(orderStorageKey(quizId)) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function writeQuestionOrder(quizId: string, order: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(orderStorageKey(quizId), JSON.stringify(order));
}

function arraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
