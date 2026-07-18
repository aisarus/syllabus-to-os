export function canonicalImmediateResultCoreFixture() {
  const now = Date.now();
  return {
    version: 1,
    programs: [],
    courses: [
      {
        id: "crs_immediate",
        title: "Immediate Result Course",
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
        id: "quiz_immediate",
        title: "Immediate Result Bank",
        courseId: "crs_immediate",
        materialId: "mat_immediate",
        createdAt: now,
      },
    ],
    quizQuestions: [
      {
        id: "qq_immediate",
        quizId: "quiz_immediate",
        prompt: "Which answer is supported by the immediate-result source?",
        options: ["Verified answer", "Distractor one", "Distractor two", "Distractor three"],
        correctIndex: 0,
        explanation: "The source explicitly supports the verified answer.",
        sourceChunkIds: ["chk_immediate"],
      },
    ],
    quizAttempts: [],
    assignments: [],
    materials: [
      {
        id: "mat_immediate",
        title: "Immediate Result Source",
        type: "lecture",
        sourceMode: "pasted_text",
        courseId: "crs_immediate",
        tags: [],
        rawText: "The verified answer is supported.",
        processingStatus: "ready",
        wordCount: 5,
        charCount: 33,
        extractionMethod: "manual",
        sourceLanguage: "en",
        createdAt: now,
        updatedAt: now,
      },
    ],
    materialChunks: [
      {
        id: "chk_immediate",
        materialId: "mat_immediate",
        order: 0,
        text: "The verified answer is supported.",
        pageNumber: 2,
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

export function canonicalImmediateResultExamFixture() {
  const now = Date.now();
  const question = {
    questionId: "qq_immediate",
    quizId: "quiz_immediate",
    prompt: "Which answer is supported by the immediate-result source?",
    options: ["Verified answer", "Distractor one", "Distractor two", "Distractor three"],
    correctIndex: 0,
    explanation: "The source explicitly supports the verified answer.",
    sourceChunkIds: ["chk_immediate"],
  };
  return {
    version: 1,
    blueprints: [
      {
        id: "blueprint_immediate",
        courseId: "crs_immediate",
        quizId: "quiz_immediate",
        title: "Immediate canonical result exam",
        durationMinutes: 30,
        questionIds: ["qq_immediate"],
        createdAt: now - 120_000,
        updatedAt: now - 120_000,
      },
    ],
    sessions: [
      {
        id: "session_old_result",
        blueprintId: "blueprint_immediate",
        courseId: "crs_immediate",
        quizId: "quiz_immediate",
        title: "Previously submitted result",
        startedAt: now - 90_000,
        deadlineAt: now - 60_000,
        status: "submitted",
        questions: [question],
        answers: { qq_immediate: 1 },
        currentQuestionId: "qq_immediate",
        result: {
          submittedAt: now - 70_000,
          timedOut: false,
          score: 0,
          correctCount: 0,
          answeredCount: 1,
          unansweredCount: 0,
          total: 1,
          questions: [
            {
              questionId: "qq_immediate",
              selectedIndex: 1,
              correctIndex: 0,
              correct: false,
              unanswered: false,
            },
          ],
        },
      },
    ],
  };
}
