import { CircleHelp, Play, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp } from "@/lib/app-context";
import { useConceptEvidenceData } from "@/lib/concept-store";
import { validateExamBlueprint } from "@/lib/exam-engine";
import { examEngineStore } from "@/lib/exam-engine-store";
import { getDataSnapshot, useData } from "@/lib/store";

interface DiagnosticExamBlueprintProps {
  initialCourseId: string;
  initialQuizId: string;
}

export function DiagnosticExamBlueprint({
  initialCourseId,
  initialQuizId,
}: DiagnosticExamBlueprintProps) {
  const { lang } = useApp();
  const isRu = lang === "ru";
  const core = useData();
  const conceptData = useConceptEvidenceData();
  const requestedQuiz = core.quizzes.find((quiz) => quiz.id === initialQuizId);
  const resolvedCourseId = core.courses.some((course) => course.id === initialCourseId)
    ? initialCourseId
    : requestedQuiz?.courseId && core.courses.some((course) => course.id === requestedQuiz.courseId)
      ? requestedQuiz.courseId
      : (core.courses[0]?.id ?? "");
  const [courseId, setCourseId] = useState(resolvedCourseId);
  const courseQuizzes = useMemo(
    () => core.quizzes.filter((quiz) => !quiz.courseId || quiz.courseId === courseId),
    [core.quizzes, courseId],
  );
  const resolvedQuizId = courseQuizzes.some((quiz) => quiz.id === initialQuizId)
    ? initialQuizId
    : (courseQuizzes[0]?.id ?? "");
  const [quizId, setQuizId] = useState(resolvedQuizId);
  const quizQuestions = useMemo(
    () => core.quizQuestions.filter((question) => question.quizId === quizId),
    [core.quizQuestions, quizId],
  );
  const [title, setTitle] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [questionIds, setQuestionIds] = useState<string[]>([]);

  useEffect(() => {
    const selectedQuiz = core.quizzes.find(
      (quiz) => quiz.id === quizId && (!quiz.courseId || quiz.courseId === courseId),
    );
    if (!selectedQuiz) setQuizId(courseQuizzes[0]?.id ?? "");
  }, [courseId, courseQuizzes, core.quizzes, quizId]);

  useEffect(() => {
    const selectedQuiz = core.quizzes.find((quiz) => quiz.id === quizId);
    setQuestionIds(quizQuestions.map((question) => question.id));
    setTitle(selectedQuiz ? `${selectedQuiz.title} — Exam` : "");
  }, [core.quizzes, quizId, quizQuestions]);

  const validation = validateExamBlueprint(
    { courseId, quizId, title, durationMinutes, questionIds },
    core,
  );
  const linkedConceptCount = conceptData.concepts.filter((concept) =>
    concept.quizQuestionIds.some((id) => questionIds.includes(id)),
  ).length;

  const startExam = () => {
    try {
      const blueprint = examEngineStore.createBlueprint({
        courseId,
        quizId,
        title,
        durationMinutes,
        questionIds,
        core: getDataSnapshot(),
      });
      examEngineStore.startSession(blueprint.id, getDataSnapshot());
      toast.success(
        isRu
          ? "Экзамен начат из выбранного диагностического банка"
          : "Exam started from the selected diagnostic bank",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <section className="mx-auto max-w-[1440px] rounded-xl border border-border bg-surface p-4 md:p-5">
      <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
        <CircleHelp className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div>
          <strong>
            {isRu
              ? "Blueprint продолжает конкретную диагностику"
              : "This blueprint continues a specific diagnostic"}
          </strong>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {isRu
              ? "Курс и банк вопросов пришли из сохранённого результата. Состав можно проверить и изменить, но Lamdan не подменяет их первым доступным квизом."
              : "The course and question bank came from the saved result. You can review or change them, but Lamdan does not replace them with the first available quiz."}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-lg border border-border bg-background p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs text-muted-foreground">
              {isRu ? "Курс" : "Course"}
              <select
                data-testid="diagnostic-exam-course"
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
                data-testid="diagnostic-exam-quiz"
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
                data-testid="diagnostic-exam-title"
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
            <span>{isRu ? "Вопросы выбранного банка" : "Selected-bank questions"}</span>
            <span className="font-mono">
              {questionIds.length}/{quizQuestions.length}
            </span>
          </div>
          <div
            data-testid="diagnostic-exam-questions"
            className="mt-2 max-h-96 space-y-2 overflow-auto"
          >
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

        <aside className="rounded-lg border border-border bg-background p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">
              {isRu ? "Проверка blueprint" : "Blueprint validation"}
            </h3>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            <Metric label={isRu ? "Вопросы" : "Questions"} value={validation.questions.length} />
            <Metric
              label={isRu ? "Источники" : "Sources"}
              value={validation.distinctSourceChunkIds.length}
            />
            <Metric label={isRu ? "Понятия" : "Concepts"} value={linkedConceptCount} />
          </div>
          {validation.errors.length > 0 && (
            <div className="mt-3 rounded-md border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-200">
              {validation.errors.map((error) => (
                <p key={error}>• {error}</p>
              ))}
            </div>
          )}
          {validation.warnings.length > 0 && (
            <div className="mt-3 rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3 text-xs text-yellow-100">
              {validation.warnings.map((warning) => (
                <p key={warning}>• {warning}</p>
              ))}
            </div>
          )}
          <Button
            data-testid="diagnostic-exam-start"
            className="mt-4 w-full"
            onClick={startExam}
            disabled={!validation.ok}
          >
            <Play className="h-4 w-4 me-1" />
            {isRu ? "Сохранить и начать" : "Save and start"}
          </Button>
        </aside>
      </div>
    </section>
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
