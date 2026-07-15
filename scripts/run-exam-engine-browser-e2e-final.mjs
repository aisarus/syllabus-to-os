import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(scriptDirectory, "run-exam-engine-browser-e2e.mjs");
const temporaryDirectory = await mkdtemp(join(tmpdir(), "lamdan-exam-engine-e2e-final-"));
const temporaryScript = join(temporaryDirectory, "run-exam-engine-browser-e2e.mjs");

const decorativeCounterWait = '    await page.waitForText("2/2");';
const functionalBlueprintWait = `    await page.waitFor(\`(() => {
      const checkboxes = [...document.querySelectorAll('input[type="checkbox"]')];
      const startButton = [...document.querySelectorAll("button")].find((button) =>
        button.textContent?.includes("Сохранить и начать")
      );
      return checkboxes.length === 2 && startButton && !startButton.disabled;
    })()\`);`;
const decorativeSessionWait =
  '    await page.waitForText("Замороженная экзаменационная сессия");';
const functionalSessionWait = `    try {
      await page.waitFor(\`(() => {
        const exams = JSON.parse(localStorage.getItem("lamdan.exam-engine.v1"));
        const session = exams.sessions?.[0];
        return session?.status === "active" &&
          session.questions?.length === 2 &&
          document.body?.innerText.includes("constitutional review");
      })()\`);
    } catch (error) {
      const state = await page.evaluate(\`(() => {
        const startButton = [...document.querySelectorAll("button")].find((button) =>
          button.textContent?.includes("Сохранить и начать")
        );
        return {
          exams: localStorage.getItem("lamdan.exam-engine.v1"),
          core: localStorage.getItem("lamdan.data.v1"),
          buttonDisabled: startButton?.disabled,
          body: document.body?.innerText.slice(0, 4000),
        };
      })()\`);
      console.error("Exam Engine session-start diagnostics:", JSON.stringify(state, null, 2));
      throw error;
    }`;
const decorativeResultWait =
  '    await page.waitForText("Замороженный результат экзамена");';
const functionalResultWait = `    try {
      await page.waitFor(\`(() => {
        const exams = JSON.parse(localStorage.getItem("lamdan.exam-engine.v1"));
        const session = exams.sessions?.[0];
        return session?.status === "submitted" &&
          session.result?.score === 100 &&
          session.result?.unansweredCount === 0 &&
          document.body?.innerText.includes("100%");
      })()\`);
    } catch (error) {
      const state = await page.evaluate(\`(() => ({
        exams: localStorage.getItem("lamdan.exam-engine.v1"),
        core: localStorage.getItem("lamdan.data.v1"),
        details: localStorage.getItem("lamdan.quiz-attempt-details.v1"),
        concepts: localStorage.getItem("lamdan.concept-evidence.v1"),
        body: document.body?.innerText.slice(0, 5000),
      }))()\`);
      console.error("Exam Engine submitted-result diagnostics:", JSON.stringify(state, null, 2));
      throw error;
    }`;

try {
  const source = await readFile(sourcePath, "utf8");
  if (!source.includes(decorativeCounterWait)) {
    throw new Error("The Exam Engine E2E source no longer contains the readiness counter check.");
  }
  if (!source.includes(decorativeSessionWait)) {
    throw new Error("The Exam Engine E2E source no longer contains the active-session heading check.");
  }
  if (source.split(decorativeResultWait).length - 1 !== 2) {
    throw new Error("The Exam Engine E2E source no longer contains both result heading checks.");
  }

  const patched = source
    .replace(decorativeCounterWait, functionalBlueprintWait)
    .replace(decorativeSessionWait, functionalSessionWait)
    .replaceAll(decorativeResultWait, functionalResultWait);
  await writeFile(temporaryScript, patched, "utf8");

  const result = spawnSync(process.execPath, [temporaryScript], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true }).catch(() => undefined);
}
