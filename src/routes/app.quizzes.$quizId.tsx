import { createFileRoute } from "@tanstack/react-router";
import { QuizStudio } from "@/components/quiz-studio";

export const Route = createFileRoute("/app/quizzes/$quizId")({
  component: QuizDetailPage,
});

function QuizDetailPage() {
  const { quizId } = Route.useParams();
  return <QuizStudio quizId={quizId} />;
}
