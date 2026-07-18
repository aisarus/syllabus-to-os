import { createFileRoute } from "@tanstack/react-router";
import { QuizLibrary } from "@/components/quiz-library";
import { StudyOutputLayout } from "@/components/study-output-layout";

export const Route = createFileRoute("/app/quizzes")({
  component: QuizzesPage,
});

function QuizzesPage() {
  return (
    <StudyOutputLayout current="quizzes">
      <QuizLibrary />
    </StudyOutputLayout>
  );
}
