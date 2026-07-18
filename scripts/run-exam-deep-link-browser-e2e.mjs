import { assert, runBrowserProof } from "./browser-proof-kit.mjs";
import { examDeepLinkFixture } from "./fixtures/exam-deep-link-fixture.mjs";

await runBrowserProof({
  name: "exam-deep-link",
  appPort: 4178,
  debugPort: 9338,
  execute: async ({ page }) => {
    await page.evaluate(`(() => {
      localStorage.clear();
      localStorage.setItem("lamdan.data.v1", ${JSON.stringify(
        JSON.stringify(examDeepLinkFixture()),
      )});
      localStorage.setItem("lamdan.lang", "ru");
      localStorage.setItem("lamdan.theme", "dark");
      return true;
    })()`);

    await page.navigate("/app/exam-engine?course=crs_target&quiz=quiz_target");
    await page.waitFor(`(() => {
      const course = document.querySelector('[data-testid="diagnostic-exam-course"]');
      const quiz = document.querySelector('[data-testid="diagnostic-exam-quiz"]');
      const title = document.querySelector('[data-testid="diagnostic-exam-title"]');
      const questions = document.querySelector('[data-testid="diagnostic-exam-questions"]');
      const start = document.querySelector('[data-testid="diagnostic-exam-start"]');
      return course?.value === "crs_target" &&
        quiz?.value === "quiz_target" &&
        title?.value.includes("Target Diagnostic Bank") &&
        questions?.innerText.includes("Question from the requested diagnostic bank") &&
        !questions?.innerText.includes("Question from the first bank") &&
        start && !start.disabled;
    })()`);

    const changed = await page.evaluate(`(() => {
      const course = document.querySelector('[data-testid="diagnostic-exam-course"]');
      if (!course) return false;
      course.value = "crs_first";
      course.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()`);
    assert(changed, "Could not change the diagnostic course.");
    await page.waitFor(`(() => {
      const quiz = document.querySelector('[data-testid="diagnostic-exam-quiz"]');
      const questions = document.querySelector('[data-testid="diagnostic-exam-questions"]');
      return quiz?.value === "quiz_first" &&
        questions?.innerText.includes("Question from the first bank") &&
        !questions?.innerText.includes("Question from the requested diagnostic bank");
    })()`);

    await page.navigate("/app/exam-engine?course=crs_target&quiz=quiz_target");
    await page.waitFor(`(() => {
      const quiz = document.querySelector('[data-testid="diagnostic-exam-quiz"]');
      const start = document.querySelector('[data-testid="diagnostic-exam-start"]');
      return quiz?.value === "quiz_target" && start && !start.disabled;
    })()`);
    const started = await page.evaluate(`(() => {
      const start = document.querySelector('[data-testid="diagnostic-exam-start"]');
      if (!start) return false;
      start.click();
      return true;
    })()`);
    assert(started, "Could not start the deep-linked exam blueprint.");
    await page.waitForText("Замороженная экзаменационная сессия");

    const persisted = await page.evaluate(`(() => {
      const exams = JSON.parse(localStorage.getItem("lamdan.exam-engine.v1"));
      const blueprint = exams.blueprints?.[0];
      const session = exams.sessions?.[0];
      return {
        courseId: blueprint?.courseId,
        quizId: blueprint?.quizId,
        blueprintQuestionIds: blueprint?.questionIds,
        sessionQuestionIds: session?.questions?.map((question) => question.questionId),
      };
    })()`);
    assert(persisted.courseId === "crs_target", "Blueprint used the wrong course.");
    assert(persisted.quizId === "quiz_target", "Blueprint used the wrong question bank.");
    assert(
      JSON.stringify(persisted.blueprintQuestionIds) === JSON.stringify(["qq_target"]),
      "Blueprint included questions from another bank.",
    );
    assert(
      JSON.stringify(persisted.sessionQuestionIds) === JSON.stringify(["qq_target"]),
      "Frozen session did not preserve the deep-linked question bank.",
    );
  },
});

console.log("✓ Exam Engine deep link selects and freezes the requested question bank");
