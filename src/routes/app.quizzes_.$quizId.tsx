import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { GoldenQuizExperience } from "@/components/golden-quiz-experience";
import { useApp } from "@/lib/app-context";

export const Route = createFileRoute("/app/quizzes_/$quizId")({
  component: QuizDetailPage,
});

function QuizDetailPage() {
  const { quizId } = Route.useParams();
  const { lang } = useApp();
  return (
    <>
      <div className="mx-auto mb-3 flex max-w-4xl justify-end">
        <Link
          to="/app/quiz-quality/$quizId"
          params={{ quizId }}
          className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm hover:bg-accent"
        >
          <ShieldCheck className="h-4 w-4 me-1" />
          {lang === "ru" ? "Проверить качество" : "Quality review"}
        </Link>
      </div>
      <GoldenQuizExperience quizId={quizId} />
    </>
  );
}
