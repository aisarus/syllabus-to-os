import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ExamEngine } from "@/components/exam-engine";
import { ExamEngineRestoredResult } from "@/components/exam-engine-restored-result";
import { useExamEngineData } from "@/lib/exam-engine-store";
import { useData } from "@/lib/store";

export const Route = createFileRoute("/app/exam-engine")({
  component: ExamEnginePage,
});

function ExamEnginePage() {
  const data = useData();
  const exams = useExamEngineData();
  const [showRestoredResult, setShowRestoredResult] = useState(true);
  const restoredSession = showRestoredResult
    ? exams.sessions.find((session) => session.status === "submitted" && session.result)
    : undefined;

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

  return <ExamEngine key={`${data.courses[0]?.id ?? "course"}:${data.quizzes.length}`} />;
}
