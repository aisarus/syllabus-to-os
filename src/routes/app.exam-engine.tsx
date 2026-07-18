import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CircleHelp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DiagnosticExamBlueprint } from "@/components/diagnostic-exam-blueprint-entry";
import { ExamEngine } from "@/components/exam-engine";
import { ExamEngineRestoredResult } from "@/components/exam-engine-restored-result";
import { ExamPlanningPanel } from "@/components/exam-planning-panel";
import { useApp } from "@/lib/app-context";
import { useExamEngineData } from "@/lib/exam-engine-store";
import { useData } from "@/lib/store";

interface ExamEngineSearch {
  course: string;
  quiz: string;
}

export const Route = createFileRoute("/app/exam-engine")({
  validateSearch: (raw): ExamEngineSearch => ({
    course: typeof raw.course === "string" ? raw.course : "",
    quiz: typeof raw.quiz === "string" ? raw.quiz : "",
  }),
  component: ExamEnginePage,
});

function ExamEnginePage() {
  const { lang } = useApp();
  const data = useData();
  const exams = useExamEngineData();
  const search = Route.useSearch();
  const [dismissedResultIds, setDismissedResultIds] = useState<string[]>([]);
  const requestedQuiz = data.quizzes.find((quiz) => quiz.id === search.quiz);
  const initialCourseId = useMemo(() => {
    if (data.courses.some((course) => course.id === search.course)) return search.course;
    if (
      requestedQuiz?.courseId &&
      data.courses.some((course) => course.id === requestedQuiz.courseId)
    ) {
      return requestedQuiz.courseId;
    }
    return data.courses[0]?.id ?? "";
  }, [data.courses, requestedQuiz?.courseId, search.course]);
  const [planningCourseId, setPlanningCourseId] = useState(initialCourseId);
  const restoredSession = exams.sessions.find(
    (session) =>
      session.status === "submitted" &&
      Boolean(session.result) &&
      !dismissedResultIds.includes(session.id),
  );
  const activeSession = exams.sessions.find((session) => session.status === "active");

  useEffect(() => {
    if (data.courses.some((course) => course.id === initialCourseId)) {
      setPlanningCourseId(initialCourseId);
      return;
    }
    setPlanningCourseId(data.courses[0]?.id ?? "");
  }, [data.courses, initialCourseId]);

  if (data.courses.length === 0) {
    return (
      <div className="mx-auto max-w-3xl rounded-xl border border-border bg-surface p-6 text-sm text-muted-foreground">
        Сначала добавь курс и source-linked вопросы. После гидратации workspace Exam Engine
        откроется с корректным банком вопросов.
      </div>
    );
  }

  if (restoredSession) {
    return (
      <ExamEngineRestoredResult
        session={restoredSession}
        onExit={() =>
          setDismissedResultIds((current) =>
            current.includes(restoredSession.id) ? current : [...current, restoredSession.id],
          )
        }
      />
    );
  }

  return (
    <>
      {requestedQuiz && (
        <section className="mx-auto mb-4 max-w-[1440px] rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <CircleHelp className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.16em] text-primary">
                  {lang === "ru" ? "Контекст диагностики" : "Diagnostic context"}
                </div>
                <strong className="mt-1 block truncate">{requestedQuiz.title}</strong>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {lang === "ru"
                    ? "Курс и банк вопросов уже выбраны для экзаменационного blueprint. Проверь состав и запускай только после source validation."
                    : "The course and question bank are preselected for the exam blueprint. Review the set and start only after source validation."}
                </p>
              </div>
            </div>
            <Link
              to="/app/quizzes/$quizId"
              params={{ quizId: requestedQuiz.id }}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {lang === "ru" ? "К результату" : "Back to result"}
            </Link>
          </div>
        </section>
      )}
      {requestedQuiz && !activeSession ? (
        <DiagnosticExamBlueprint
          key={`${initialCourseId}:${requestedQuiz.id}:${data.quizzes.length}`}
          initialCourseId={initialCourseId}
          initialQuizId={requestedQuiz.id}
        />
      ) : (
        <ExamEngine key={`${data.courses.length}:${data.quizzes.length}`} />
      )}
      {!activeSession ? (
        <>
          <div className="mx-auto mt-5 max-w-[1440px] rounded-xl border border-border bg-surface p-4 md:p-5">
            <label className="block max-w-sm text-xs text-muted-foreground">
              {lang === "ru" ? "Курс для плана подготовки" : "Course for the study plan"}
              <select
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={planningCourseId}
                onChange={(event) => setPlanningCourseId(event.target.value)}
              >
                {data.courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mx-auto max-w-[1440px]">
            <ExamPlanningPanel core={data} courseId={planningCourseId} isRu={lang === "ru"} />
          </div>
        </>
      ) : null}
    </>
  );
}
