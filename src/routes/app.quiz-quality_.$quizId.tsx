import { createFileRoute } from "@tanstack/react-router";
import { GoldenQuizQualityReview } from "@/components/golden-quiz-quality-review";

export const Route = createFileRoute("/app/quiz-quality_/$quizId")({
  component: QuizQualityPage,
});

function QuizQualityPage() {
  const { quizId } = Route.useParams();
  return <GoldenQuizQualityReview quizId={quizId} />;
}
