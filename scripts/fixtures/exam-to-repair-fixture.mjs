const golden = (explanation, hint) =>
  `[[LAM_DAN_GOLDEN_QUIZ_V1]]\n\n### Correct explanation\n${explanation}\n\n### Memory hint\n${hint}\n\n### Option rationales\n1. Supported by the source.\n2. Not supported.\n3. Not supported.\n4. Not supported.`;

export function examRepairCoreFixture() {
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
    quizQuestions: [
      {
        id: "qq_wrong",
        quizId: "quiz_result",
        prompt: "Which option is supported for the first concept?",
        options: ["Verified first", "Wrong first", "C first", "D first"],
        correctIndex: 0,
        explanation: golden(
          "The source supports the verified first answer.",
          "Return to the first source definition.",
        ),
        sourceChunkIds: ["chk_result"],
      },
      {
        id: "qq_unanswered",
        quizId: "quiz_result",
        prompt: "Which option is supported for the second concept?",
        options: ["Verified second", "Wrong second", "C second", "D second"],
        correctIndex: 0,
        explanation: golden(
          "The source supports the verified second answer.",
          "Return to the second source definition.",
        ),
        sourceChunkIds: ["chk_result"],
      },
      {
        id: "qq_correct",
        quizId: "quiz_result",
        prompt: "Which option is supported for the third concept?",
        options: ["Verified third", "Wrong third", "C third", "D third"],
        correctIndex: 0,
        explanation: golden(
          "The source supports the verified third answer.",
          "Return to the third source definition.",
        ),
        sourceChunkIds: ["chk_result"],
      },
    ],
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
        rawText: "The source supports all three verified answers.",
        processingStatus: "ready",
        wordCount: 8,
        charCount: 47,
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
        text: "The source supports all three verified answers.",
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

export function examRepairFrozenFixture() {
  const now = Date.now();
  const core = examRepairCoreFixture();
  const questions = core.quizQuestions.map((question) => ({
    questionId: question.id,
    quizId: question.quizId,
    prompt: question.prompt,
    options: question.options,
    correctIndex: question.correctIndex,
    explanation: question.explanation,
    sourceChunkIds: question.sourceChunkIds,
  }));
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
