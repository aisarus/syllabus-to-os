import { assert, runBrowserProof } from "./browser-proof-kit.mjs";

function coreFixture() {
  const now = Date.now();
  return {
    version: 1,
    programs: [],
    courses: [
      {
        id: "crs_result",
        title: "Result Course",
        status: "in_progress",
        order: 0,
        createdAt: now,
      },
    ],
    topics: [],
    notes: [],
    flashcards: [],
    quizzes: [
      {
        id: "quiz_result",
        title: "Result Question Bank",
        courseId: "crs_result",
        materialId: "mat_result",
        createdAt: now,
      },
    ],
    quizQuestions: [],
    quizAttempts: [],
    assignments: [],
    materials: [
      {
        id: "mat_result",
        title: "Result Source",
        type: "lecture",
        sourceMode: "pasted_text",
        courseId: "crs_result",
        tags: [],
        rawText: "The source supports the verified answers.",
        processingStatus: "ready",
        wordCount: 6,
        charCount: 41,
        extractionMethod: "manual",
        sourceLanguage: "en",
        createdAt: now,
        updatedAt: now,
      },
    ],
    materialChunks: [
      {
        id: "chk_result",
        materialId: "mat_result",
        order: 0,
        text: "The source supports the verified answers.",
        pageNumber: 7,
        createdAt: now,
      },
    ],
    materialOutputs: [],
    presentationOutlines: [],
    calendarEvents: [],
    studySessions: [],
    syllabusImports: [],
  };
}

function examFixture() {
  const now = Date.now();
  const questions = [
    {
      questionId: "qq_wrong",
      quizId: "quiz_result",
      prompt: "Which option is supported for the first concept?",
      options: ["Verified first", "Wrong first", "C", "D"],
      correctIndex: 0,
      explanation: "Return to the source definition for the first concept.",
      sourceChunkIds: ["chk_result"],
    },
    {
      questionId: "qq_unanswered",
      quizId: "quiz_result",
      prompt: "Which option is supported for the second concept?",
      options: ["Verified second", "Wrong second", "C", "D"],
      correctIndex: 0,
      explanation: "The second concept is also defined in the source.",
      sourceChunkIds: ["chk_result"],
    },
    {
      questionId: "qq_correct",
      quizId: "quiz_result",
      prompt: "Which option is supported for the third concept?",
      options: ["Verified third", "Wrong third", "C", "D"],
      correctIndex: 0,
      explanation: "The third answer was correct.",
      sourceChunkIds: ["chk_result"],
    },
  ];
  return {
    version: 1,
    blueprints: [
      {
        id: "blueprint_result",
        courseId: "crs_result",
        quizId: "quiz_result",
        title: "Frozen result review",
        durationMinutes: 30,
        questionIds: questions.map((question) => question.questionId),
        createdAt: now,
        updatedAt: now,
      },
    ],
    sessions: [
      {
        id: "session_result",
        blueprintId: "blueprint_result",
        courseId: "crs_result",
        quizId: "quiz_result",
        title: "Frozen result review",
        startedAt: now - 60_000,
        deadlineAt: now + 60_000,
        status: "submitted",
        questions,
        answers: { qq_wrong: 1, qq_correct: 0 },
        currentQuestionId: "qq_correct",
        result: {
          submittedAt: now,
          timedOut: false,
          score: 33,
          correctCount: 1,
          answeredCount: 2,
          unansweredCount: 1,
          total: 3,
          questions: [
            {
              questionId: "qq_wrong",
              selectedIndex: 1,
              correctIndex: 0,
              correct: false,
              unanswered: false,
            },
            {
              questionId: "qq_unanswered",
              correctIndex: 0,
              correct: false,
              unanswered: true,
            },
            {
              questionId: "qq_correct",
              selectedIndex: 0,
              correctIndex: 0,
              correct: true,
              unanswered: false,
            },
          ],
        },
      },
    ],
  };
}

await runBrowserProof({
  name: "exam-result-review",
  appPort: 4179,
  debugPort: 9339,
  execute: async ({ page }) => {
    const frozen = JSON.stringify(examFixture());
    await page.evaluate(`(() => {
      localStorage.clear();
      localStorage.setItem("lamdan.data.v1", ${JSON.stringify(JSON.stringify(coreFixture()))});
      localStorage.setItem("lamdan.exam-engine.v1", ${JSON.stringify(frozen)});
      localStorage.setItem("lamdan.lang", "ru");
      localStorage.setItem("lamdan.theme", "dark");
      return true;
    })()`);

    await page.navigate("/app/exam-engine");
    await page.waitForText("2 вопросов требуют возврата к источнику");
    await page.waitForText("Which option is supported for the first concept?");
    await page.waitForText("без ответа");
    await page.waitForText("Правильные ответы этой попытки · 1");

    const links = await page.evaluate(`(() =>
      [...document.querySelectorAll("a")].map((link) => link.getAttribute("href"))
    )()`);
    assert(links.includes("/app/materials/mat_result"), "Exam mistake source link is missing.");
    assert(links.includes("/app/quizzes/quiz_result"), "Exam result trainer link is missing.");

    const beforeReload = await page.evaluate(`localStorage.getItem("lamdan.exam-engine.v1")`);
    assert(beforeReload === frozen, "Viewing the result mutated the frozen exam snapshot.");
    await page.reload();
    await page.waitForText("2 вопросов требуют возврата к источнику");
    const afterReload = await page.evaluate(`localStorage.getItem("lamdan.exam-engine.v1")`);
    assert(afterReload === frozen, "Reload rewrote the frozen exam snapshot.");
  },
});

console.log("✓ frozen exam result opens a source-linked review without mutating the snapshot");
