import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(scriptDirectory, "run-long-media-browser-e2e-v2.mjs");
const temporaryDirectory = await mkdtemp(join(tmpdir(), "lamdan-long-media-e2e-final-"));
const temporaryScript = join(temporaryDirectory, "run-long-media-browser-e2e.mjs");

const earlyHardNavigation = `    if (!(await page.evaluate(\`location.pathname === "/app/materials/\${materialId}"\`))) {
      await page.navigate(\`/app/materials/\${materialId}\`);
    }
    await page.waitForText("Длинная запись лекции", 45_000);`;

const completedUploadNavigation = `    await page.waitFor(
      \`location.pathname === "/app/materials/\${materialId}"\`,
      25_000,
    );
    await page.waitForText("ДЛИННАЯ ЗАПИСЬ ЛЕКЦИИ", 45_000);`;

const eagerPromiseBoolean = "if (await this.evaluate(`Boolean(${expression})`)) return;";
const awaitedPredicate =
  "if (await this.evaluate(`Promise.resolve(${expression}).then(Boolean)`)) return;";
const transcriptTextWait = '    await page.waitForText("Первая часть полной лекции");';
const transcriptTextareaWait = `    await page.waitFor(
      \`[...document.querySelectorAll("textarea")].some((element) =>
        element.value.includes("Первая часть полной лекции")
      )\`,
    );`;
const transcriptHeadingWait = '    await page.waitForText("Расшифровка по таймкодам");';
const renderedTranscriptHeadingWait =
  '    await page.waitForText("РАСШИФРОВКА ПО ТАЙМКОДАМ");';

try {
  const source = await readFile(sourcePath, "utf8");
  if (!source.includes(earlyHardNavigation)) {
    throw new Error("The long-media E2E source no longer contains the guarded navigation block.");
  }
  if (!source.includes(eagerPromiseBoolean)) {
    throw new Error("The long-media E2E source no longer contains the predicate evaluation block.");
  }
  if (source.split(transcriptTextWait).length - 1 !== 2) {
    throw new Error("The long-media E2E source no longer contains both transcript text checks.");
  }
  if (!source.includes(transcriptHeadingWait)) {
    throw new Error("The long-media E2E source no longer contains the transcript heading check.");
  }

  const patched = source
    .replace(eagerPromiseBoolean, awaitedPredicate)
    .replace(earlyHardNavigation, completedUploadNavigation)
    .replaceAll(transcriptTextWait, transcriptTextareaWait)
    .replace(transcriptHeadingWait, renderedTranscriptHeadingWait);
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
