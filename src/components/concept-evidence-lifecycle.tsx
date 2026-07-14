import { useEffect } from "react";
import {
  installConceptEvidenceBridge,
  reconcileConceptEvidence,
  syncQuizAttemptEvidence,
  useConceptEvidenceData,
} from "@/lib/concept-store";
import { useData } from "@/lib/store";

installConceptEvidenceBridge();

export function ConceptEvidenceLifecycle() {
  const core = useData();
  const conceptData = useConceptEvidenceData();

  useEffect(() => {
    reconcileConceptEvidence(core);
    syncQuizAttemptEvidence(core);
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
