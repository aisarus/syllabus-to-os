import { createFileRoute } from "@tanstack/react-router";
import { ExamEngine } from "@/components/exam-engine";

export const Route = createFileRoute("/app/exam-engine")({
  component: ExamEnginePage,
});

function ExamEnginePage() {
  return <ExamEngine />;
}
