import { createFileRoute } from "@tanstack/react-router";
import { GoldenQuizExperience } from "@/components/golden-quiz-experience";

export const Route = createFileRoute("/app/quizzes_/$quizId")({
  component: QuizDetailPage,
});

function QuizDetailPage() {
  const { quizId } = Route.useParams();
  return <GoldenQuizExperience quizId={quizId} />;
}
