import { createFileRoute } from "@tanstack/react-router";
import { QuizLibrary } from "@/components/quiz-library";

export const Route = createFileRoute("/app/quizzes")({
  component: QuizzesPage,
});

function QuizzesPage() {
  return <QuizLibrary />;
}
