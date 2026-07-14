import { createFileRoute } from "@tanstack/react-router";
import { EvidenceQuizExperience } from "@/components/evidence-quiz-experience";

export const Route = createFileRoute("/app/quizzes_/$quizId")({
  component: QuizDetailPage,
});

function QuizDetailPage() {
  const { quizId } = Route.useParams();
  return <EvidenceQuizExperience quizId={quizId} />;
}
