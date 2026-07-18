import { assert, runBrowserProof } from "./browser-proof-kit.mjs";
import {
  canonicalImmediateResultCoreFixture,
  canonicalImmediateResultExamFixture,
} from "./fixtures/canonical-immediate-exam-result-fixture.mjs";

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
  name: "canonical-immediate-exam-result",
  appPort: 4181,
  debugPort: 9341,
  execute: async ({ page }) => {
    await page.evaluate(`(() => {
      localStorage.clear();
      localStorage.setItem("lamdan.data.v1", ${JSON.stringify(
        JSON.stringify(canonicalImmediateResultCoreFixture()),
      )});
      localStorage.setItem("lamdan.exam-engine.v1", ${JSON.stringify(
        JSON.stringify(canonicalImmediateResultExamFixture()),
      )});
      localStorage.setItem("lamdan.lang", "ru");
      localStorage.setItem("lamdan.theme", "dark");
      window.confirm = () => true;
      return true;
    })()`);

    await page.navigate("/app/exam-engine");
    await page.waitForText("Сохранённый frozen result");
    await page.waitForText("Previously submitted result");
    await clickExact(page, "К blueprints");
    await page.waitForText("Сохранённые blueprints");
    await clickExact(page, "Начать");
    await page.waitForText("Замороженная экзаменационная сессия");
    await page.waitForText("Immediate canonical result exam");
    await clickExact(page, "Verified answer");
    await page.evaluate(`window.confirm = () => true`);
    await clickExact(page, "Сдать экзамен");

    await page.waitForText("Сохранённый frozen result");
    await page.waitForText("Immediate canonical result exam");
    await page.waitForText("Ошибок и пропусков в этой попытке нет");
    const immediateBody = await page.evaluate(`document.body.innerText`);
    assert(
      !immediateBody.includes("Замороженный результат экзамена"),
      "Immediate submit fell back to the legacy inline result.",
    );

    const persisted = await page.evaluate(`(() => {
      const exams = JSON.parse(localStorage.getItem("lamdan.exam-engine.v1"));
      return {
        sessions: exams.sessions.map((session) => ({
          id: session.id,
          title: session.title,
          status: session.status,
          score: session.result?.score,
        })),
      };
    })()`);
    assert(persisted.sessions.length === 2, "The new submission did not create a second session.");
    assert(
      persisted.sessions[0].id !== "session_old_result",
      "The newly submitted session was not stored before the old result.",
    );
    assert(persisted.sessions[0].status === "submitted", "The new session was not submitted.");
    assert(persisted.sessions[0].score === 100, "The new canonical result has the wrong score.");
    assert(
      persisted.sessions[1].id === "session_old_result" && persisted.sessions[1].score === 0,
      "Dismissing the old result mutated its frozen session.",
    );

    await page.reload();
    await page.waitForText("Сохранённый frozen result");
    await page.waitForText("Immediate canonical result exam");
    const reloadedBody = await page.evaluate(`document.body.innerText`);
    assert(
      !reloadedBody.includes("Previously submitted result"),
      "Reload restored the older result instead of the newest submission.",
    );
  },
});

console.log("✓ immediate and restored exam submissions share the canonical result screen");
