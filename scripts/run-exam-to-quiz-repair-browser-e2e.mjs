import { assert, runBrowserProof } from "./browser-proof-kit.mjs";
import {
  examRepairCoreFixture,
  examRepairFrozenFixture,
} from "./fixtures/exam-to-repair-fixture.mjs";

async function clickExact(page, label) {
  const clicked = await page.evaluate(`(() => {
    const target = [...document.querySelectorAll("button, a")].find((element) =>
      element.getClientRects().length > 0 &&
      !("disabled" in element && element.disabled) &&
      element.textContent?.replace(/\\s+/g, " ").trim() === ${JSON.stringify(label)}
    );
    if (!target) return false;
    target.click();
    return true;
  })()`);
  assert(clicked, `Could not click: ${label}`);
}

await runBrowserProof({
  name: "exam-to-quiz-repair",
  appPort: 4180,
  debugPort: 9340,
  execute: async ({ page }) => {
    const frozen = JSON.stringify(examRepairFrozenFixture());
    await page.evaluate(`(() => {
      localStorage.clear();
      localStorage.setItem("lamdan.data.v1", ${JSON.stringify(
        JSON.stringify(examRepairCoreFixture()),
      )});
      localStorage.setItem("lamdan.exam-engine.v1", ${JSON.stringify(frozen)});
      localStorage.setItem("lamdan.lang", "ru");
      localStorage.setItem("lamdan.theme", "dark");
      return true;
    })()`);

    await page.navigate("/app/exam-engine");
    await page.waitForText("2 вопросов требуют возврата к источнику");
    await clickExact(page, "Исправить эти вопросы · 2");
    await page.waitForText("Repair после экзамена");
    await page.waitForText("только 2 ошибочных или пропущенных вопросов");
    await page.waitForText("Which option is supported for the first concept?");
    const scope = await page.evaluate(`document.body.innerText`);
    assert(
      !scope.includes("Which option is supported for the third concept?"),
      "A correct exam question leaked into repair mode.",
    );

    await clickExact(page, "Verified first");
    await clickExact(page, "Следующий вопрос");
    await page.waitForText("Which option is supported for the second concept?");
    await clickExact(page, "Verified second");
    await clickExact(page, "Сохранить repair-попытку");
    await page.waitForText("100% · 2/2");
    await page.waitForText("Frozen exam result не изменён");

    const persisted = await page.evaluate(`(() => {
      const core = JSON.parse(localStorage.getItem("lamdan.data.v1"));
      const details = JSON.parse(localStorage.getItem("lamdan.quiz-attempt-details.v1"));
      return {
        exam: localStorage.getItem("lamdan.exam-engine.v1"),
        attempt: core.quizAttempts[0],
        answerIds: details.attempts[0]?.answers.map((answer) => answer.questionId),
        answerOutcomes: details.attempts[0]?.answers.map((answer) => answer.correct),
      };
    })()`);
    assert(persisted.exam === frozen, "Repair mutated the frozen exam snapshot.");
    assert(persisted.attempt.total === 2, "Repair attempt included the wrong number of questions.");
    assert(persisted.attempt.correctCount === 2, "Repair attempt score was not persisted.");
    assert(
      JSON.stringify(persisted.answerIds) === JSON.stringify(["qq_wrong", "qq_unanswered"]),
      "Repair answer snapshots contain questions outside the missed set.",
    );
    assert(
      persisted.answerOutcomes.every(Boolean),
      "Correct repair answers were not saved as success evidence.",
    );

    await page.reload();
    await page.waitForText("Repair после экзамена");
    const afterReload = await page.evaluate(`localStorage.getItem("lamdan.exam-engine.v1")`);
    assert(afterReload === frozen, "Reload after repair changed the frozen exam snapshot.");
  },
});

console.log("✓ frozen exam mistakes open a focused repair attempt without mutating the exam");
