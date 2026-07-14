import { useEffect } from "react";
import {
  installConceptEvidenceBridge,
  reconcileConceptEvidence,
  syncQuizAttemptEvidence,
  useConceptEvidenceData,
} from "@/lib/concept-store";
import {
  getQuizAttemptDetailSnapshot,
  reconcileQuizAttemptDetails,
  useQuizAttemptDetailData,
} from "@/lib/quiz-attempt-details";
import { getDataSnapshot, useData } from "@/lib/store";

installConceptEvidenceBridge();

export function ConceptEvidenceLifecycle() {
  const core = useData();
  const conceptData = useConceptEvidenceData();
  const detailData = useQuizAttemptDetailData();

  useEffect(() => {
    const hydratedCore = getDataSnapshot();
    reconcileQuizAttemptDetails(hydratedCore);
    const hydratedDetails = getQuizAttemptDetailSnapshot();
    reconcileConceptEvidence(hydratedCore, hydratedDetails);
    syncQuizAttemptEvidence(hydratedCore, hydratedDetails);
  }, [
    core.courses,
    core.topics,
    core.materialChunks,
    core.flashcards,
    core.quizQuestions,
    core.quizAttempts,
    core.quizzes,
    conceptData.concepts,
    detailData.attempts,
  ]);

  return null;
}
