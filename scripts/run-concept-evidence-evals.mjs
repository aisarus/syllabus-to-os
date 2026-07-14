import assert from "node:assert/strict";
import {
  emptyConceptEvidenceData,
  normalizeConceptEvidenceData,
  reconcileConceptEvidenceData,
  summarizeConceptEvidence,
} from "../src/lib/concept-evidence.ts";

const DAY = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 6, 14, 12, 0, 0);

const concept = {
  id: "con_1",
  courseId: "crs_1",
  topicId: "top_1",
  title: "Separation of powers",
  aliases: [],
  sourceChunkIds: ["chk_1"],
  flashcardIds: ["card_1"],
  quizQuestionIds: ["qq_1"],
  createdAt: now - 30 * DAY,
  updatedAt: now,
};

const event = (id, kind, outcome, occurredAt, extra = {}) => ({
  id,
  conceptId: concept.id,
  kind,
  outcome,
  sourceType: "manual",
  occurredAt,
  ...extra,
});

{
  const normalized = normalizeConceptEvidenceData({
    version: 99,
    concepts: [concept, { broken: true }],
    evidenceEvents: [event("e1", "recall", "success", now), { broken: true }],
  });
  assert.equal(normalized.version, 1);
  assert.equal(normalized.concepts.length, 1);
  assert.equal(normalized.evidenceEvents.length, 1);
}

{
  const summary = summarizeConceptEvidence(
    concept,
    [event("lucky", "recognition", "success", now)],
    now,
  );
  assert.equal(summary.state, "fragile", "one lucky answer must not create strong knowledge");
}

{
  const summary = summarizeConceptEvidence(
    concept,
    [
      event("neutral", "assessment", "mixed", now, {
        sourceType: "quiz_attempt",
        sourceId: "att_1",
        score: 100,
      }),
    ],
    now,
  );
  assert.equal(summary.state, "covered", "aggregate quiz context must not increase concept state");
  assert.equal(summary.neutralAssessmentCount, 1);
}

{
  const summary = summarizeConceptEvidence(
    concept,
    [
      event("m1", "explanation", "success", now - 2 * DAY),
      event("m2", "application", "success", now - 2 * DAY + 1000),
      event("m3", "explanation", "success", now - DAY),
      event("m4", "application", "success", now),
    ],
    now,
  );
  assert.equal(summary.state, "fragile", "manual self-evidence must remain secondary");
  assert.equal(summary.objectiveSuccessCount, 0);
}

{
  const summary = summarizeConceptEvidence(
    concept,
    [
      event("s1", "recall", "success", now - 2 * DAY, {
        sourceType: "flashcard_review",
        sourceId: "card_1",
      }),
      event("s2", "explanation", "success", now - 2 * DAY + 1000),
      event("s3", "recall", "success", now - DAY, {
        sourceType: "flashcard_review",
        sourceId: "card_1",
      }),
      event("s4", "application", "success", now),
    ],
    now,
  );
  assert.equal(summary.state, "strong");
  assert.equal(summary.objectiveSuccessCount, 2);
  assert.equal(summary.distinctSuccessDays, 3);
  assert.ok(summary.distinctSuccessKinds.length >= 2);
}

{
  const summary = summarizeConceptEvidence(
    concept,
    [
      event("f1", "recall", "failure", now - DAY),
      event("f2", "application", "failure", now),
      event("s1", "recognition", "success", now - 3 * DAY),
    ],
    now,
  );
  assert.equal(summary.state, "weak");
}

{
  const summary = summarizeConceptEvidence(
    concept,
    [event("old", "explanation", "success", now - 30 * DAY)],
    now,
  );
  assert.equal(summary.forgettingRisk, "high");
  assert.notEqual(summary.state, "strong");
}

{
  const core = {
    version: 1,
    programs: [],
    courses: [{ id: "crs_1" }],
    topics: [{ id: "top_1" }],
    notes: [],
    flashcards: [],
    quizzes: [{ id: "quiz_1" }],
    quizQuestions: [{ id: "qq_1", quizId: "quiz_1" }],
    quizAttempts: [{ id: "att_1", quizId: "quiz_1" }],
    assignments: [],
    materials: [],
    materialChunks: [{ id: "chk_1" }],
    materialOutputs: [],
    presentationOutlines: [],
    calendarEvents: [],
    studySessions: [],
    syllabusImports: [],
  };
  const reconciled = reconcileConceptEvidenceData(
    {
      version: 1,
      concepts: [concept],
      evidenceEvents: [
        event("card-event", "recall", "success", now, {
          sourceType: "flashcard_review",
          sourceId: "card_1",
        }),
        event("quiz-event", "assessment", "mixed", now, {
          sourceType: "quiz_attempt",
          sourceId: "att_1",
        }),
        event("manual-event", "explanation", "success", now),
      ],
    },
    core,
  );
  assert.deepEqual(reconciled.concepts[0].sourceChunkIds, ["chk_1"]);
  assert.deepEqual(reconciled.concepts[0].flashcardIds, []);
  assert.deepEqual(reconciled.concepts[0].quizQuestionIds, ["qq_1"]);
  assert.deepEqual(
    reconciled.evidenceEvents.map((item) => item.id).sort(),
    ["manual-event", "quiz-event"],
    "deleted practice must not leave dangling evidence",
  );

  const unlinked = reconcileConceptEvidenceData(
    {
      ...reconciled,
      concepts: [{ ...reconciled.concepts[0], quizQuestionIds: [] }],
    },
    core,
  );
  assert.equal(
    unlinked.evidenceEvents.some((item) => item.id === "quiz-event"),
    false,
    "unlinked quiz context must be removed",
  );
}

assert.deepEqual(emptyConceptEvidenceData(), { version: 1, concepts: [], evidenceEvents: [] });
console.log("Concept evidence evaluations passed.");
