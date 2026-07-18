import { ExamResultDecision } from "@/components/exam-result-decision";
import type { ExamSession } from "@/lib/exam-engine";

export function ExamEngineRestoredResult({
  session,
  onExit,
}: {
  session: ExamSession;
  onExit: () => void;
}) {
  return <ExamResultDecision session={session} onExit={onExit} />;
}
