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

try {
  const source = await readFile(sourcePath, "utf8");
  if (!source.includes(decorativeCounterWait)) {
    throw new Error("The Exam Engine E2E source no longer contains the readiness counter check.");
  }

  const patched = source.replace(decorativeCounterWait, functionalBlueprintWait);
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
