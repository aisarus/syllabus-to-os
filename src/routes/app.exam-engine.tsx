import { createFileRoute } from "@tanstack/react-router";
import { ExamEngine } from "@/components/exam-engine";
import { useData } from "@/lib/store";

export const Route = createFileRoute("/app/exam-engine")({
  component: ExamEnginePage,
});

function ExamEnginePage() {
  const data = useData();

  if (data.courses.length === 0) {
    return (
      <div className="mx-auto max-w-3xl rounded-xl border border-border bg-surface p-6 text-sm text-muted-foreground">
        Сначала добавь курс и source-linked вопросы. После гидратации workspace Exam Engine
        откроется с корректным банком вопросов.
      </div>
    );
  }

  return <ExamEngine key={`${data.courses[0]?.id ?? "course"}:${data.quizzes.length}`} />;
}
