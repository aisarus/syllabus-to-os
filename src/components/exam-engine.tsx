import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileCheck2,
  GraduationCap,
  Play,
  RotateCcw,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/app-shell";
import { useApp } from "@/lib/app-context";
import { useConceptEvidenceData } from "@/lib/concept-store";
import { validateExamBlueprint, type ExamBlueprint, type ExamSession } from "@/lib/exam-engine";
import { examEngineStore, useExamEngineData } from "@/lib/exam-engine-store";
import { getDataSnapshot, useData } from "@/lib/store";

export function ExamEngine() {
  const { lang } = useApp();
  const isRu = lang === "ru";
  const core = useData();
  const conceptData = useConceptEvidenceData();
  const examData = useExamEngineData();
  const [courseId, setCourseId] = useState(core.courses[0]?.id ?? "");
  const courseQuizzes = core.quizzes.filter((quiz) => !quiz.courseId || quiz.courseId === courseId);
  const [quizId, setQuizId] = useState(courseQuizzes[0]?.id ?? "");
  const quizQuestions = core.quizQuestions.filter((question) => question.quizId === quizId);
  const [title, setTitle] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [questionIds, setQuestionIds] = useState<string[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const nextQuiz = core.quizzes.find(
      (quiz) => quiz.id === quizId && (!quiz.courseId || quiz.courseId === courseId),
    );
    if (!nextQuiz) setQuizId(courseQuizzes[0]?.id ?? "");
  }, [courseId, quizId, courseQuizzes, core.quizzes]);

  useEffect(() => {
    setQuestionIds(quizQuestions.map((question) => question.id));
    const quiz = core.quizzes.find((item) => item.id === quizId);
    setTitle(quiz ? `${quiz.title} — Exam` : "");
  }, [quizId, quizQuestions.length, core.quizzes]);

  const activeSession = examData.sessions.find((session) => session.id === activeSessionId);
  const runningSession =
    activeSession?.status === "active"
      ? activeSession
      : examData.sessions.find((session) => session.status === "active");
  const displayedSession = activeSession ?? runningSession;

  useEffect(() => {
    if (!displayedSession || displayedSession.status !== "active") return;
    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, [displayedSession?.id, displayedSession?.status]);

  useEffect(() => {
    if (displayedSession?.status === "active" && now >= displayedSession.deadlineAt) {
      try {
        examEngineStore.submit(displayedSession.id, now);
        toast.warning(
          isRu ? "Время истекло. Экзамен отправлен." : "Time expired. The exam was submitted.",
        );
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error));
      }
    }
  }, [now, displayedSession?.id, displayedSession?.status, displayedSession?.deadlineAt, isRu]);

  const draftValidation = validateExamBlueprint(
    {
      courseId,
      quizId,
      title,
      durationMinutes,
      questionIds,
    },
    core,
  );
  const linkedConceptCount = conceptData.concepts.filter((concept) =>
    concept.quizQuestionIds.some((id) => questionIds.includes(id)),
  ).length;

  const createBlueprint = () => {
    try {
      const blueprint = examEngineStore.createBlueprint({
        courseId,
        quizId,
        title,
        durationMinutes,
        questionIds,
        core: getDataSnapshot(),
      });
      toast.success(isRu ? "Экзаменационный blueprint сохранён" : "Exam blueprint saved");
      startBlueprint(blueprint);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  const startBlueprint = (blueprint: ExamBlueprint) => {
    try {
      const session = examEngineStore.startSession(blueprint.id, getDataSnapshot());
      setActiveSessionId(session.id);
      setNow(Date.now());
      toast.success(
        isRu ? "Экзамен начат. Вопросы заморожены." : "Exam started. Questions are frozen.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  if (displayedSession) {
    return (
      <ExamSessionView
        session={displayedSession}
        now={now}
        isRu={isRu}
        onExit={() => setActiveSessionId(null)}
      />
    );
  }

  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader
        title={isRu ? "Exam Engine" : "Exam Engine"}
        subtitle={
          isRu
            ? "Source-grounded экзамены с замороженными вопросами, дедлайном и evidence только по реальным ответам."
            : "Source-grounded exams with frozen questions, deadlines and evidence only for actual answers."
        }
      />

      <section className="rounded-xl border border-border bg-surface p-4 md:p-5">
        <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <strong>
              {isRu ? "Что Exam Engine делает честно" : "What the Exam Engine guarantees"}
            </strong>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {isRu
                ? "Экзамен стартует только из source-linked вопросов. После старта prompt, options, correct answer и source ids заморожены. Итог — сырой score, а не прогноз оценки или «готовность к экзамену»."
                : "An exam starts only from source-linked questions. Prompt, options, correct answer and source ids freeze at start. The result is a raw score, not a grade prediction or readiness claim."}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-lg border border-border bg-background p-4">
            <h2 className="font-serif text-xl font-semibold">
              {isRu ? "Новый blueprint" : "New blueprint"}
            </h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="text-xs text-muted-foreground">
                {isRu ? "Курс" : "Course"}
                <select
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={courseId}
                  onChange={(event) => setCourseId(event.target.value)}
                >
                  {core.courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-muted-foreground">
                {isRu ? "Банк вопросов" : "Question bank"}
                <select
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={quizId}
                  onChange={(event) => setQuizId(event.target.value)}
                >
                  {courseQuizzes.map((quiz) => (
                    <option key={quiz.id} value={quiz.id}>
                      {quiz.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-muted-foreground md:col-span-2">
                {isRu ? "Название экзамена" : "Exam title"}
                <Input
                  className="mt-1"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>
              <label className="text-xs text-muted-foreground">
                {isRu ? "Время, минут" : "Duration, minutes"}
                <Input
                  className="mt-1"
                  type="number"
                  min={1}
                  max={240}
                  value={durationMinutes}
                  onChange={(event) => setDurationMinutes(Number(event.target.value))}
                />
              </label>
            </div>

            <div className="mt-5 flex items-center justify-between text-xs text-muted-foreground">
              <span>{isRu ? "Вопросы" : "Questions"}</span>
              <span className="font-mono">
                {questionIds.length}/{quizQuestions.length}
              </span>
            </div>
            <div className="mt-2 max-h-96 space-y-2 overflow-auto pe-1">
              {quizQuestions.map((question) => {
                const sourceCount = question.sourceChunkIds?.length ?? 0;
                return (
                  <label
                    key={question.id}
                    className="flex cursor-pointer gap-3 rounded-md border border-border p-3 text-sm"
                  >
                    <input
                      className="mt-1"
                      type="checkbox"
                      checked={questionIds.includes(question.id)}
                      onChange={() =>
                        setQuestionIds((current) =>
                          current.includes(question.id)
                            ? current.filter((id) => id !== question.id)
                            : [...current, question.id],
                        )
                      }
                    />
                    <span className="min-w-0 flex-1">
                      <strong className="line-clamp-2 font-medium">{question.prompt}</strong>
                      <span
                        className={`mt-1 block text-xs ${sourceCount ? "text-muted-foreground" : "text-red-300"}`}
                      >
                        {sourceCount
                          ? `${sourceCount} source chunk(s)`
                          : isRu
                            ? "Нет source relationship — вопрос заблокирован"
                            : "No source relationship — question is blocked"}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-lg border border-border bg-background p-4">
              <h3 className="font-semibold">
                {isRu ? "Проверка blueprint" : "Blueprint validation"}
              </h3>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <Metric
                  label={isRu ? "Вопросы" : "Questions"}
                  value={draftValidation.questions.length}
                />
                <Metric
                  label={isRu ? "Источники" : "Sources"}
                  value={draftValidation.distinctSourceChunkIds.length}
                />
                <Metric label={isRu ? "Понятия" : "Concepts"} value={linkedConceptCount} />
              </div>
              {draftValidation.errors.length > 0 && (
                <div className="mt-3 rounded-md border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-200">
                  {draftValidation.errors.map((error) => (
                    <p key={error}>• {error}</p>
                  ))}
                </div>
              )}
              {draftValidation.warnings.length > 0 && (
                <div className="mt-3 rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3 text-xs text-yellow-100">
                  {draftValidation.warnings.map((warning) => (
                    <p key={warning}>• {warning}</p>
                  ))}
                </div>
              )}
              <Button
                className="mt-4 w-full"
                onClick={createBlueprint}
                disabled={!draftValidation.ok}
              >
                <Play className="h-4 w-4 me-1" />
                {isRu ? "Сохранить и начать" : "Save and start"}
              </Button>
            </div>

            <div className="rounded-lg border border-border bg-background p-4">
              <h3 className="font-semibold">
                {isRu ? "Сохранённые blueprints" : "Saved blueprints"}
              </h3>
              <div className="mt-3 space-y-2">
                {examData.blueprints.map((blueprint) => (
                  <div key={blueprint.id} className="rounded-md border border-border p-3 text-xs">
                    <strong className="block truncate">{blueprint.title}</strong>
                    <span className="mt-1 block text-muted-foreground">
                      {blueprint.questionIds.length} {isRu ? "вопросов" : "questions"} ·{" "}
                      {blueprint.durationMinutes} min
                    </span>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" onClick={() => startBlueprint(blueprint)}>
                        <Play className="h-3.5 w-3.5 me-1" />
                        {isRu ? "Начать" : "Start"}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => examEngineStore.deleteBlueprint(blueprint.id)}
                        aria-label={isRu ? "Удалить blueprint" : "Delete blueprint"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {examData.blueprints.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    {isRu ? "Blueprints пока нет." : "No blueprints yet."}
                  </p>
                )}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

function ExamSessionView({
  session,
  now,
  isRu,
  onExit,
}: {
  session: ExamSession;
  now: number;
  isRu: boolean;
  onExit: () => void;
}) {
  const questionIndex = Math.max(
    0,
    session.questions.findIndex((question) => question.questionId === session.currentQuestionId),
  );
  const question = session.questions[questionIndex];
  const remainingMs = Math.max(0, session.deadlineAt - now);
  const answeredCount = Object.keys(session.answers).length;

  if (session.status === "submitted" && session.result) {
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeader
          title={session.title}
          subtitle={isRu ? "Замороженный результат экзамена" : "Frozen exam result"}
        />
        <section className="rounded-xl border border-border bg-surface p-5">
          <div className="grid gap-3 sm:grid-cols-4">
            <ResultMetric label={isRu ? "Score" : "Score"} value={`${session.result.score}%`} />
            <ResultMetric
              label={isRu ? "Верно" : "Correct"}
              value={`${session.result.correctCount}/${session.result.total}`}
            />
            <ResultMetric
              label={isRu ? "Без ответа" : "Unanswered"}
              value={String(session.result.unansweredCount)}
            />
            <ResultMetric
              label={isRu ? "Время" : "Timing"}
              value={
                session.result.timedOut
                  ? isRu
                    ? "Истекло"
                    : "Timed out"
                  : isRu
                    ? "Сдано"
                    : "Submitted"
              }
            />
          </div>
          <div className="mt-5 flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
            <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p className="text-muted-foreground">
              {isRu
                ? "Question-level evidence создан только для отвеченных вопросов. Неподанные ответы не превращаются в выдуманные failure events. Score — фактический результат этой сессии, не прогноз экзаменационной оценки."
                : "Question-level evidence was created only for answered questions. Unanswered items do not become invented failure events. The score is this session’s raw result, not a grade prediction."}
            </p>
          </div>
          <div className="mt-5 space-y-3">
            {session.questions.map((item, index) => {
              const result = session.result?.questions.find(
                (value) => value.questionId === item.questionId,
              );
              const selectedIndex = result?.selectedIndex;
              return (
                <article
                  key={item.questionId}
                  className="rounded-lg border border-border bg-background p-4"
                >
                  <div className="flex items-start gap-2">
                    {result?.correct ? (
                      <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-300" />
                    ) : (
                      <XCircle className="mt-0.5 h-5 w-5 text-red-300" />
                    )}
                    <div className="min-w-0 flex-1">
                      <strong>
                        {index + 1}. {item.prompt}
                      </strong>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {isRu ? "Твой ответ" : "Your answer"}:{" "}
                        {selectedIndex === undefined
                          ? isRu
                            ? "нет"
                            : "none"
                          : item.options[selectedIndex]}
                      </p>
                      <p className="mt-1 text-sm text-emerald-200">
                        {isRu ? "Правильный" : "Correct"}: {item.options[item.correctIndex]}
                      </p>
                      {item.explanation && (
                        <p className="mt-2 whitespace-pre-wrap rounded bg-muted/30 p-3 text-xs text-muted-foreground">
                          {item.explanation}
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          <Button className="mt-5" variant="outline" onClick={onExit}>
            <RotateCcw className="h-4 w-4 me-1" />
            {isRu ? "К blueprints" : "Back to blueprints"}
          </Button>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-primary">
            <GraduationCap className="h-4 w-4" />
            {isRu ? "Замороженная экзаменационная сессия" : "Frozen exam session"}
          </div>
          <h1 className="mt-1 font-serif text-2xl font-semibold">{session.title}</h1>
        </div>
        <div
          className={`flex items-center gap-2 rounded-lg border px-4 py-2 font-mono text-lg ${remainingMs < 60_000 ? "border-red-500/40 text-red-200" : "border-border"}`}
        >
          <Clock3 className="h-5 w-5" />
          {formatRemaining(remainingMs)}
        </div>
      </div>

      <section className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {isRu ? "Вопрос" : "Question"} {questionIndex + 1}/{session.questions.length}
          </span>
          <span>
            {answeredCount} {isRu ? "отвечено" : "answered"}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-[width]"
            style={{ width: `${((questionIndex + 1) / session.questions.length) * 100}%` }}
          />
        </div>

        <h2 className="mt-6 font-serif text-2xl font-semibold leading-10">{question.prompt}</h2>
        <div className="mt-5 space-y-3">
          {question.options.map((option, optionIndex) => {
            const selected = session.answers[question.questionId] === optionIndex;
            return (
              <button
                key={optionIndex}
                type="button"
                className={`flex w-full items-start gap-3 rounded-xl border p-4 text-start ${selected ? "border-primary bg-primary/10" : "border-border bg-background hover:border-primary/50"}`}
                onClick={() => {
                  try {
                    examEngineStore.answer(session.id, question.questionId, optionIndex);
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : String(error));
                  }
                }}
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-current text-xs font-semibold">
                  {String.fromCharCode(65 + optionIndex)}
                </span>
                <span>{option}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="outline"
            disabled={questionIndex === 0}
            onClick={() =>
              examEngineStore.setCurrentQuestion(
                session.id,
                session.questions[questionIndex - 1].questionId,
              )
            }
          >
            <ChevronLeft className="h-4 w-4 me-1" />
            {isRu ? "Назад" : "Previous"}
          </Button>
          <div className="flex flex-wrap gap-1">
            {session.questions.map((item, index) => (
              <button
                key={item.questionId}
                type="button"
                className={`h-8 min-w-8 rounded border px-2 text-xs ${item.questionId === question.questionId ? "border-primary bg-primary/10" : session.answers[item.questionId] !== undefined ? "border-emerald-500/40 bg-emerald-500/5" : "border-border"}`}
                onClick={() => examEngineStore.setCurrentQuestion(session.id, item.questionId)}
              >
                {index + 1}
              </button>
            ))}
          </div>
          {questionIndex < session.questions.length - 1 ? (
            <Button
              onClick={() =>
                examEngineStore.setCurrentQuestion(
                  session.id,
                  session.questions[questionIndex + 1].questionId,
                )
              }
            >
              {isRu ? "Дальше" : "Next"}
              <ChevronRight className="h-4 w-4 ms-1" />
            </Button>
          ) : (
            <Button
              variant="destructive"
              onClick={() => {
                if (
                  confirm(
                    isRu
                      ? `Отправить экзамен? Отвечено ${answeredCount}/${session.questions.length}.`
                      : `Submit the exam? Answered ${answeredCount}/${session.questions.length}.`,
                  )
                ) {
                  try {
                    examEngineStore.submit(session.id);
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : String(error));
                  }
                }
              }}
            >
              {isRu ? "Сдать экзамен" : "Submit exam"}
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border p-2">
      <strong className="block font-mono text-lg">{value}</strong>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

function ResultMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4 text-center">
      <strong className="block font-mono text-2xl">{value}</strong>
      <span className="mt-1 text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function formatRemaining(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1_000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}
