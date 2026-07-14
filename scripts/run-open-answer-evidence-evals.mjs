import assert from "node:assert/strict";
import {
  evidenceIsObjective,
  reconcileConceptEvidenceData,
  summarizeConceptEvidence,
} from "../src/lib/concept-evidence.ts";
import {
  normalizeOpenAnswerReview,
  validateOpenAnswerSaveDraft,
} from "../src/lib/open-answer-review.ts";

const concept = {
  id: "con_1",
  courseId: "crs_1",
  title: "Judicial review",
  description: "Courts review government decisions.",
  aliases: [],
  sourceChunkIds: ["chk_1"],
  flashcardIds: [],
  quizQuestionIds: [],
  createdAt: 1,
  updatedAt: 1,
};

const core = {
  version: 1,
  programs: [],
  courses: [{ id: "crs_1" }],
  topics: [],
  notes: [],
  flashcards: [],
  quizzes: [],
  quizQuestions: [],
  quizAttempts: [],
  assignments: [],
  materials: [{ id: "mat_1" }],
  materialChunks: [{ id: "chk_1", materialId: "mat_1" }],
  materialOutputs: [],
  presentationOutlines: [],
  calendarEvents: [],
  studySessions: [],
  syllabusImports: [],
};

{
  const review = normalizeOpenAnswerReview(
    {
      suggestedOutcome: "success",
      suggestedScore: 87.6,
      feedback: "The central claim is supported.",
      strengths: ["Correct distinction"],
      missingPoints: [],
      suggestedMistakeKind: "careless",
      supportedSourceChunkIds: ["chk_1", "unknown", "chk_1"],
      warnings: ["Check terminology"],
      notFoundInSources: false,
    },
    ["chk_1"],
  );
  assert.equal(review.suggestedOutcome, "success");
  assert.equal(review.suggestedScore, 88);
  assert.deepEqual(review.supportedSourceChunkIds, ["chk_1"]);
}

{
  const review = normalizeOpenAnswerReview(
    {
      suggestedOutcome: "success",
      suggestedScore: 99,
      feedback: "Looks right",
      supportedSourceChunkIds: ["invented"],
    },
    ["chk_1"],
  );
  assert.equal(review.notFoundInSources, true);
  assert.equal(review.suggestedOutcome, "failure");
  assert.equal(
    review.supportedSourceChunkIds.length,
    0,
    "unknown citations must never survive an open-answer review",
  );
}

{
  const invalid = validateOpenAnswerSaveDraft(
    {
      conceptId: "con_1",
      conceptTitle: "Judicial review",
      kind: "explanation",
      prompt: "Explain it",
      response: "Too short",
      sourceChunkIds: ["deleted"],
      outcome: "success",
      reviewMode: "human",
    },
    ["chk_1"],
  );
  assert.equal(invalid.ok, false, "answers without current concept sources must not be saved");
}

const humanSuccess = {
  id: "cev_human",
  conceptId: "con_1",
  kind: "explanation",
  outcome: "success",
  sourceType: "open_answer_review",
  sourceChunkIds: ["chk_1"],
  prompt: "Explain judicial review",
  response: "A court checks a government decision against the legal framework.",
  reviewMode: "human",
  reviewSummary: "Self-reviewed against the source.",
  occurredAt: 1_700_000_000_000,
};
const aiHumanSuccess = {
  ...humanSuccess,
  id: "cev_ai_human",
  reviewMode: "ai_human",
  occurredAt: 1_700_000_100_000,
};

assert.equal(
  evidenceIsObjective(humanSuccess),
  false,
  "human-only open answer must remain secondary",
);
assert.equal(evidenceIsObjective(aiHumanSuccess), true);

{
  const summary = summarizeConceptEvidence(concept, [humanSuccess], humanSuccess.occurredAt);
  assert.equal(summary.state, "fragile");
  assert.equal(summary.objectiveSuccessCount, 0);
}

const originalFailure = {
  id: "cev_failure",
  conceptId: "con_1",
  kind: "application",
  outcome: "failure",
  sourceType: "open_answer_review",
  sourceChunkIds: ["chk_1"],
  prompt: "Apply judicial review to the case",
  response: "The executive reviews its own decision.",
  reviewMode: "ai_human",
  reviewSummary: "The response confuses the reviewing institution.",
  mistakeKind: "confusion",
  occurredAt: 1_700_000_000_000,
};
const repairSuccess = {
  id: "cev_repair",
  conceptId: "con_1",
  kind: "application",
  outcome: "success",
  sourceType: "open_answer_review",
  sourceChunkIds: ["chk_1"],
  prompt: "Apply judicial review to the case again",
  response: "An independent court reviews the government decision under the legal framework.",
  reviewMode: "ai_human",
  reviewSummary: "The corrected answer identifies the reviewing institution.",
  repairOfEvidenceId: "cev_failure",
  occurredAt: 1_700_000_200_000,
};

{
  const reconciled = reconcileConceptEvidenceData(
    {
      version: 1,
      concepts: [concept],
      evidenceEvents: [originalFailure, repairSuccess],
    },
    core,
  );
  assert.equal(reconciled.evidenceEvents.length, 2);
  assert.equal(
    reconciled.evidenceEvents.find((event) => event.id === "cev_repair")?.repairOfEvidenceId,
    "cev_failure",
    "repair must keep the original failure inspectable",
  );
  assert.equal(
    reconciled.evidenceEvents.some((event) => event.id === "cev_failure"),
    true,
    "repair must never overwrite the original failure",
  );
}

{
  const reconciled = reconcileConceptEvidenceData(
    {
      version: 1,
      concepts: [concept],
      evidenceEvents: [{ ...repairSuccess, repairOfEvidenceId: "missing_failure" }],
    },
    core,
  );
  assert.equal(
    reconciled.evidenceEvents[0]?.repairOfEvidenceId,
    undefined,
    "orphan repair links must be removed",
  );
}

{
  const coreWithoutChunk = { ...core, materialChunks: [] };
  const reconciled = reconcileConceptEvidenceData(
    { version: 1, concepts: [concept], evidenceEvents: [originalFailure] },
    coreWithoutChunk,
  );
  assert.equal(
    reconciled.evidenceEvents.length,
    0,
    "deleted source chunks must remove open-answer evidence",
  );
}

console.log("Open-answer evidence and mistake repair evaluations passed.");
