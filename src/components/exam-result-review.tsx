import { ExamResultReviewList } from "@/components/exam-result-review-list";
import { ExamResultSummary } from "@/components/exam-result-summary";
import { useApp } from "@/lib/app-context";
import type { ExamSession } from "@/lib/exam-engine";
import { useData } from "@/lib/store";

export function ExamResultDecision({
  session,
  onExit,
}: {
  session: ExamSession;
  onExit: () => void;
}) {
  const { lang } = useApp();
  const data = useData();
  const isRu = lang === "ru";
  if (!session.result) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <ExamResultSummary session={session} isRu={isRu} />
      <ExamResultReviewList session={session} isRu={isRu} data={data} onExit={onExit} />
    </div>
  );
}
