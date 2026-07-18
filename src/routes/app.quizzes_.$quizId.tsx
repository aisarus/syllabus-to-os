import { createFileRoute } from "@tanstack/react-router";
import { EvidenceQuizExperience } from "@/components/evidence-quiz-experience";
import { StudyOutputLayout } from "@/components/study-output-layout";

export const Route = createFileRoute("/app/quizzes_/$quizId")({
  component: QuizDetailPage,
});

function QuizDetailPage() {
  const { quizId } = Route.useParams();
  return (
    <StudyOutputLayout current="quizzes" compact>
      <EvidenceQuizExperience quizId={quizId} />
    </StudyOutputLayout>
  );
}
