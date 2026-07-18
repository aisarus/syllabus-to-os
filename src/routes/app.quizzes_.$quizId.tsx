import { createFileRoute } from "@tanstack/react-router";
import { EvidenceQuizExperience } from "@/components/evidence-quiz-experience";
import { StudyOutputLayout } from "@/components/study-output-layout";
import { parseQuizRepairQuestionIds } from "@/lib/quiz-repair-search";

interface QuizRepairSearch {
  repair: string[];
}

export const Route = createFileRoute("/app/quizzes_/$quizId")({
  validateSearch: (raw): QuizRepairSearch => ({
    repair: parseQuizRepairQuestionIds(raw.repair),
  }),
  component: QuizDetailPage,
});

function QuizDetailPage() {
  const { quizId } = Route.useParams();
  const { repair } = Route.useSearch();
  return (
    <StudyOutputLayout current="quizzes" compact>
      <EvidenceQuizExperience quizId={quizId} initialRepairQuestionIds={repair} />
    </StudyOutputLayout>
  );
}
