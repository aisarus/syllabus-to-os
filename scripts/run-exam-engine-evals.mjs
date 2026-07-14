import assert from "node:assert/strict";
import {
  answerExamQuestion,
  createFrozenExamSession,
  normalizeExamEngineData,
  submitExamSession,
  validateExamBlueprint,
} from "../src/lib/exam-engine.ts";

const now = 1_700_000_000_000;
const core = {
  version: 1,
  programs: [],
  courses: [{ id: "crs_1", title: "Course", status: "in_progress", order: 0, createdAt: now }],
  topics: [],
  notes: [],
  flashcards: [],
  quizzes: [{ id: "quiz_1", title: "Exam bank", courseId: "crs_1", createdAt: now }],
  quizQuestions: [
    {
      id: "qq_1",
      quizId: "quiz_1",
      prompt: "Question one",
      options: ["A", "B", "C", "D"],
      correctIndex: 0,
      explanation: "A is supported.",
      sourceChunkIds: ["chk_1"],
    },
    {
      id: "qq_2",
      quizId: "quiz_1",
      prompt: "Question two",
      options: ["A", "B", "C", "D"],
      correctIndex: 1,
      explanation: "B is supported.",
      sourceChunkIds: ["chk_2"],
    },
  ],
  quizAttempts: [],
  assignments: [],
  materials: [{ id: "mat_1" }],
  materialChunks: [
    { id: "chk_1", materialId: "mat_1", order: 0, text: "Source one", createdAt: now },
    { id: "chk_2", materialId: "mat_1", order: 1, text: "Source two", createdAt: now },
  ],
  materialOutputs: [],
  presentationOutlines: [],
  calendarEvents: [],
  studySessions: [],
  syllabusImports: [],
};

const blueprint = {
  id: "exam_blueprint_1",
  courseId: "crs_1",
  quizId: "quiz_1",
  title: "Frozen exam",
  durationMinutes: 30,
  questionIds: ["qq_1", "qq_2"],
  createdAt: now,
  updatedAt: now,
};

{
  const validation = validateExamBlueprint(blueprint, core);
  assert.equal(validation.ok, true);
  assert.equal(validation.questions.length, 2);
  assert.deepEqual(validation.distinctSourceChunkIds.sort(), ["chk_1", "chk_2"]);
}

{
  const ungroundedCore = {
    ...core,
    quizQuestions: [
      { ...core.quizQuestions[0], sourceChunkIds: [] },
      core.quizQuestions[1],
    ],
  };
  const validation = validateExamBlueprint(blueprint, ungroundedCore);
  assert.equal(validation.ok, false);
  assert.ok(
    validation.errors.some((error) => error.includes("no approved source relationship")),
    "an ungrounded question must block exam start",
  );
}

{
  const session = createFrozenExamSession({
    id: "exam_session_1",
    blueprint,
    questions: core.quizQuestions,
    startedAt: now,
  });
  const originalPrompt = session.questions[0].prompt;
  core.quizQuestions[0].prompt = "Edited after exam start";
  assert.equal(
    session.questions[0].prompt,
    originalPrompt,
    "question edits must not rewrite a frozen exam session",
  );
  assert.equal(session.deadlineAt, now + 30 * 60_000);
}

{
  let session = createFrozenExamSession({
    id: "exam_session_answered",
    blueprint,
    questions: core.quizQuestions,
    startedAt: now,
  });
  const first = session.questions[0];
  const second = session.questions[1];
  session = answerExamQuestion(session, first.questionId, first.correctIndex, now + 1_000);
  session = answerExamQuestion(
    session,
    second.questionId,
    second.correctIndex === 0 ? 1 : 0,
    now + 2_000,
  );
  session = submitExamSession(session, now + 3_000);
  assert.equal(session.status, "submitted");
  assert.equal(session.result?.correctCount, 1);
  assert.equal(session.result?.answeredCount, 2);
  assert.equal(session.result?.unansweredCount, 0);
  assert.equal(session.result?.score, 50);
  assert.equal(session.result?.timedOut, false);
}

{
  let session = createFrozenExamSession({
    id: "exam_session_partial",
    blueprint,
    questions: core.quizQuestions,
    startedAt: now,
  });
  const first = session.questions[0];
  session = answerExamQuestion(session, first.questionId, first.correctIndex, now + 1_000);
  session = submitExamSession(session, session.deadlineAt + 1);
  assert.equal(session.result?.answeredCount, 1);
  assert.equal(session.result?.unansweredCount, 1);
  assert.equal(session.result?.timedOut, true);
  assert.equal(
    session.result?.questions.filter((item) => item.unanswered).length,
    1,
    "unanswered exam questions must remain explicit instead of becoming invented failures",
  );
}

{
  const normalized = normalizeExamEngineData({
    version: 99,
    blueprints: [blueprint, { broken: true }],
    sessions: [
      createFrozenExamSession({
        id: "exam_session_normalized",
        blueprint,
        questions: core.quizQuestions,
        startedAt: now,
      }),
      { broken: true },
    ],
  });
  assert.equal(normalized.version, 1);
  assert.equal(normalized.blueprints.length, 1);
  assert.equal(normalized.sessions.length, 1);
}

console.log("Frozen source-grounded Exam Engine evaluations passed.");
