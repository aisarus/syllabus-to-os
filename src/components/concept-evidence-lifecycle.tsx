import { useEffect } from "react";
import {
  installConceptEvidenceBridge,
  reconcileConceptEvidence,
  syncQuizAttemptEvidence,
  useConceptEvidenceData,
} from "@/lib/concept-store";
import { getDataSnapshot, useData } from "@/lib/store";

installConceptEvidenceBridge();

export function ConceptEvidenceLifecycle() {
  const core = useData();
  const conceptData = useConceptEvidenceData();

  useEffect(() => {
    const hydratedCore = getDataSnapshot();
    reconcileConceptEvidence(hydratedCore);
    syncQuizAttemptEvidence(hydratedCore);
  }, [
    core.courses,
    core.topics,
    core.materialChunks,
    core.flashcards,
    core.quizQuestions,
    core.quizAttempts,
    core.quizzes,
    conceptData.concepts,
  ]);

  return null;
}
