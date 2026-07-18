import { createFileRoute } from "@tanstack/react-router";
import { EvidenceQuizExperience } from "@/components/evidence-quiz-experience";
import { QuizRepairRunner } from "@/components/quiz-repair-runner";
import { StudyOutputLayout } from "@/components/study-output-layout";
import { parseQuizRepairQuestionIds } from "@/lib/quiz-repair-search";

interface QuizRepairSearch {
  repair?: string[];
}

export const Route = createFileRoute("/app/quizzes_/$quizId")({
  validateSearch: (raw): QuizRepairSearch => {
    const repair = parseQuizRepairQuestionIds(raw.repair);
    return repair.length > 0 ? { repair } : {};
  },
  component: QuizDetailPage,
});

function QuizDetailPage() {
  const { quizId } = Route.useParams();
  const search = Route.useSearch();
  const repair = search.repair ?? [];
  return (
    <StudyOutputLayout current="quizzes" compact>
      {repair.length > 0 ? (
        <QuizRepairRunner quizId={quizId} requestedQuestionIds={repair} />
      ) : (
        <EvidenceQuizExperience quizId={quizId} />
      )}
    </StudyOutputLayout>
  );
}
