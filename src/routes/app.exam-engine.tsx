import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ExamEngine } from "@/components/exam-engine";
import { ExamEngineRestoredResult } from "@/components/exam-engine-restored-result";
import { ExamPlanningPanel } from "@/components/exam-planning-panel";
import { useApp } from "@/lib/app-context";
import { useExamEngineData } from "@/lib/exam-engine-store";
import { useData } from "@/lib/store";

export const Route = createFileRoute("/app/exam-engine")({
  component: ExamEnginePage,
});

function ExamEnginePage() {
  const { lang } = useApp();
  const data = useData();
  const exams = useExamEngineData();
  const [showRestoredResult, setShowRestoredResult] = useState(true);
  const [planningCourseId, setPlanningCourseId] = useState(data.courses[0]?.id ?? "");
  const restoredSession = showRestoredResult
    ? exams.sessions.find((session) => session.status === "submitted" && session.result)
    : undefined;
  const activeSession = exams.sessions.find((session) => session.status === "active");

  useEffect(() => {
    if (!data.courses.some((course) => course.id === planningCourseId)) {
      setPlanningCourseId(data.courses[0]?.id ?? "");
    }
  }, [data.courses, planningCourseId]);

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
        onExit={() => setShowRestoredResult(false)}
      />
    );
  }

  return (
    <>
      <ExamEngine key={`${data.courses[0]?.id ?? "course"}:${data.quizzes.length}`} />
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
