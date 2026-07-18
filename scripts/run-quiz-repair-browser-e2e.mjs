import { assert, runBrowserProof } from "./browser-proof-kit.mjs";

function fixture() {
  const now = Date.now();
  return {
    version: 1,
    programs: [],
    courses: [
      {
        id: "crs_repair",
        title: "Repair Course",
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
        id: "quiz_repair",
        title: "Repair Diagnostic",
        courseId: "crs_repair",
        materialId: "mat_repair",
        createdAt: now,
      },
    ],
    quizQuestions: [
      {
        id: "qq_repair",
        quizId: "quiz_repair",
        prompt: "Which answer is supported by the source?",
        options: ["Verified answer", "Distractor one", "Distractor two", "Distractor three"],
        correctIndex: 0,
        explanation:
          "[[LAM_DAN_GOLDEN_QUIZ_V1]]\n\n### Correct explanation\nThe verified answer is correct.\n\n### Memory hint\nReturn to the source definition.\n\n### Option rationales\n1. Supported.\n2. Unsupported.\n3. Unsupported.\n4. Unsupported.",
        sourceChunkIds: ["chk_repair"],
      },
    ],
    quizAttempts: [],
    assignments: [],
    materials: [
      {
        id: "mat_repair",
        title: "Repair Source",
        type: "lecture",
        sourceMode: "pasted_text",
        courseId: "crs_repair",
        tags: [],
        rawText: "The verified answer is correct.",
        processingStatus: "ready",
        wordCount: 6,
        charCount: 31,
        extractionMethod: "manual",
        sourceLanguage: "en",
        createdAt: now,
        updatedAt: now,
      },
    ],
    materialChunks: [
      {
        id: "chk_repair",
        materialId: "mat_repair",
        order: 0,
        text: "The verified answer is correct.",
        pageNumber: 3,
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

async function clickText(page, text) {
  const clicked = await page.evaluate(`(() => {
    const target = [...document.querySelectorAll("button, a")].find((element) =>
      element.getClientRects().length > 0 &&
      !("disabled" in element && element.disabled) &&
      element.textContent?.replace(/\\s+/g, " ").trim().includes(${JSON.stringify(text)})
    );
    if (!target) return false;
    target.click();
    return true;
  })()`);
  assert(clicked, `Could not click text: ${text}`);
}

await runBrowserProof({
  name: "quiz-repair",
  appPort: 4177,
  debugPort: 9337,
  execute: async ({ page }) => {
    await page.evaluate(`(() => {
      localStorage.clear();
      localStorage.setItem("lamdan.data.v1", ${JSON.stringify(JSON.stringify(fixture()))});
      localStorage.setItem("lamdan.lang", "ru");
      localStorage.setItem("lamdan.theme", "dark");
      return true;
    })()`);

    await page.navigate("/app/quizzes/quiz_repair");
    await page.waitForText("Which answer is supported by the source?");
    await clickText(page, "Distractor one");
    await page.waitForText("Неверно");
    await clickText(page, "Сохранить попытку");
    await page.waitForText("1 ошибок требуют разбора");

    const resultLinks = await page.evaluate(`(() =>
      [...document.querySelectorAll("a")].map((link) => link.getAttribute("href"))
    )()`);
    assert(resultLinks.includes("/app/materials/mat_repair"), "Mistake source link is missing.");
    assert(
      resultLinks.some(
        (href) =>
          href?.startsWith("/app/exam-engine?") &&
          href.includes("course=crs_repair") &&
          href.includes("quiz=quiz_repair"),
      ),
      "Exam Engine continuation did not preserve course and quiz context.",
    );

    await clickText(page, "Повторить только ошибки (1)");
    await page.waitForText("Режим исправления: 1 ошибочных вопросов");
    await clickText(page, "Verified answer");
    await page.waitForText("Верно");
    await clickText(page, "Сохранить попытку");
    await page.waitForText("Ошибок в этой попытке нет");

    const history = await page.evaluate(`(() => {
      const core = JSON.parse(localStorage.getItem("lamdan.data.v1"));
      const details = JSON.parse(localStorage.getItem("lamdan.quiz-attempt-details.v1"));
      return {
        coreAttempts: core.quizAttempts.map((attempt) => ({
          total: attempt.total,
          correctCount: attempt.correctCount,
        })),
        detailAnswers: details.attempts.map((attempt) =>
          attempt.answers.map((answer) => ({
            questionId: answer.questionId,
            selectedOption: answer.selectedOption,
            correct: answer.correct,
          })),
        ),
      };
    })()`);
    assert(history.coreAttempts.length === 2, "Repair did not create a separate core attempt.");
    assert(history.detailAnswers.length === 2, "Repair did not create a separate answer snapshot.");
    assert(history.detailAnswers[0][0].selectedOption === "Distractor one", "Original mistake changed.");
    assert(history.detailAnswers[0][0].correct === false, "Original failure evidence changed.");
    assert(history.detailAnswers[1][0].selectedOption === "Verified answer", "Repair answer missing.");
    assert(history.detailAnswers[1][0].correct === true, "Repair success evidence missing.");

    await page.reload();
    await page.waitForText("Repair Diagnostic");
    const persistedAttemptCount = await page.evaluate(`
      JSON.parse(localStorage.getItem("lamdan.quiz-attempt-details.v1")).attempts.length
    `);
    assert(persistedAttemptCount === 2, "Repair history did not survive reload.");
  },
});

console.log("✓ quiz result creates a source-linked mistake repair loop");
