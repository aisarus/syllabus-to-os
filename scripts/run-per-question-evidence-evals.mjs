import assert from "node:assert/strict";
import {
  buildQuizAttemptAnswerSnapshots,
  normalizeQuizAttemptDetailData,
} from "../src/lib/quiz-attempt-details.ts";
import {
  reconcileConceptEvidenceData,
  summarizeConceptEvidence,
} from "../src/lib/concept-evidence.ts";

const question = {
  id: "qq_1",
  quizId: "quiz_1",
  prompt: "Which branch interprets the law?",
  options: ["Executive", "Judiciary", "Legislature", "Municipality"],
  correctIndex: 1,
  explanation: "",
  sourceChunkIds: ["chk_1"],
};

{
  const snapshots = buildQuizAttemptAnswerSnapshots([question], { qq_1: 1 });
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0].correct, true);
  assert.equal(snapshots[0].selectedOption, "Judiciary");
  assert.equal(snapshots[0].correctOption, "Judiciary");
  assert.deepEqual(snapshots[0].sourceChunkIds, ["chk_1"]);

  question.prompt = "Edited later";
  question.options[1] = "Edited answer";
  assert.equal(snapshots[0].questionPrompt, "Which branch interprets the law?");
  assert.equal(snapshots[0].selectedOption, "Judiciary", "attempt history must be immutable");
}

{
  assert.throws(
    () => buildQuizAttemptAnswerSnapshots([question], {}),
    /no valid selected answer/,
    "an incomplete attempt must not be saved",
  );
}

const detailData = normalizeQuizAttemptDetailData({
  version: 9,
  attempts: [
    {
      attemptId: "att_1",
      quizId: "quiz_1",
      mode: "trainer",
      createdAt: 1000,
      answers: [
        {
          questionId: "qq_1",
          questionPrompt: "Snapshot prompt",
          selectedIndex: 0,
          selectedOption: "Executive",
          correctIndex: 1,
          correctOption: "Judiciary",
          correct: false,
          sourceChunkIds: ["chk_1"],
        },
      ],
    },
    { broken: true },
  ],
});
assert.equal(detailData.version, 1);
assert.equal(detailData.attempts.length, 1);

const concept = {
  id: "con_1",
  courseId: "crs_1",
  title: "Separation of powers",
  aliases: [],
  sourceChunkIds: ["chk_1"],
  flashcardIds: [],
  quizQuestionIds: ["qq_1"],
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
  quizzes: [{ id: "quiz_1" }],
  quizQuestions: [{ ...question, id: "qq_1", quizId: "quiz_1" }],
  quizAttempts: [
    { id: "att_1", quizId: "quiz_1", score: 0, correctCount: 0, total: 1, takenAt: 1000 },
  ],
  assignments: [],
  materials: [],
  materialChunks: [{ id: "chk_1" }],
  materialOutputs: [],
  presentationOutlines: [],
  calendarEvents: [],
  studySessions: [],
  syllabusImports: [],
};

{
  const event = {
    id: "cev_1",
    conceptId: "con_1",
    kind: "recognition",
    outcome: "failure",
    sourceType: "quiz_question_answer",
    sourceId: "att_1",
    attemptId: "att_1",
    questionId: "qq_1",
    sourceLabel: "Snapshot prompt",
    mistakeKind: "unclassified",
    occurredAt: 1000,
  };
  const reconciled = reconcileConceptEvidenceData(
    { version: 1, concepts: [concept], evidenceEvents: [event] },
    core,
    detailData,
  );
  assert.equal(reconciled.evidenceEvents.length, 1);
  const summary = summarizeConceptEvidence(concept, reconciled.evidenceEvents, 1000);
  assert.equal(summary.failureCount, 1);
  assert.equal(summary.neutralAssessmentCount, 0);
}

{
  const historical = {
    id: "old_context",
    conceptId: "con_1",
    kind: "assessment",
    outcome: "mixed",
    sourceType: "quiz_attempt",
    sourceId: "att_1",
    occurredAt: 1000,
  };
  const reconciled = reconcileConceptEvidenceData(
    { version: 1, concepts: [concept], evidenceEvents: [historical] },
    core,
    detailData,
  );
  assert.equal(
    reconciled.evidenceEvents.length,
    0,
    "aggregate context must disappear when detailed answers exist",
  );
}

{
  const event = {
    id: "cev_1",
    conceptId: "con_1",
    kind: "recognition",
    outcome: "failure",
    sourceType: "quiz_question_answer",
    sourceId: "att_1",
    attemptId: "att_1",
    questionId: "qq_1",
    occurredAt: 1000,
  };
  const unlinkedConcept = { ...concept, quizQuestionIds: [] };
  const reconciled = reconcileConceptEvidenceData(
    { version: 1, concepts: [unlinkedConcept], evidenceEvents: [event] },
    core,
    detailData,
  );
  assert.equal(reconciled.evidenceEvents.length, 0, "unlinked question evidence must be repaired");
}

console.log("Per-question quiz evidence evaluations passed.");
