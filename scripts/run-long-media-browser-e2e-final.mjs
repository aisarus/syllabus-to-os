import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(scriptDirectory, "run-long-media-browser-e2e-v2.mjs");
const temporaryDirectory = await mkdtemp(join(tmpdir(), "lamdan-long-media-e2e-final-"));
const temporaryScript = join(temporaryDirectory, "run-long-media-browser-e2e.mjs");

const initialReadyBeforeSeed = `    await page.waitFor("document.readyState === 'complete'");

    await page.evaluate(\`(async () => {`;
const explicitOriginBeforeSeed = `    await page.navigate("/app/dashboard");

    await page.evaluate(\`(async () => {`;
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
const passiveFileInput = `  async setFile(selector, path) {
    const { root } = await this.send("DOM.getDocument", { depth: -1, pierce: true });
    const { nodeId } = await this.send("DOM.querySelector", {
      nodeId: root.nodeId,
      selector,
    });
    assert(nodeId, \`File input was not found: \${selector}\`);
    await this.send("DOM.setFileInputFiles", { nodeId, files: [path] });
  }`;
const eventfulFileInput = `  async setFile(selector, path) {
    const { root } = await this.send("DOM.getDocument", { depth: -1, pierce: true });
    const { nodeId } = await this.send("DOM.querySelector", {
      nodeId: root.nodeId,
      selector,
    });
    assert(nodeId, \`File input was not found: \${selector}\`);
    await this.send("DOM.setFileInputFiles", { nodeId, files: [path] });
    const selectedName = await this.evaluate(\`(() => {
      const input = document.querySelector(\${JSON.stringify(selector)});
      if (!(input instanceof HTMLInputElement) || !input.files?.[0]) return "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return input.files[0].name;
    })()\`);
    assert(selectedName, \`The browser did not attach a file to: \${selector}\`);
    return selectedName;
  }`;
const mediaTextWait = '    await page.waitForText("whole-lecture.webm");';
const mediaInputWait = `    await page.waitFor(
      \`document.querySelector('input[type="file"][accept*="audio/*"]')?.files?.[0]?.name === "whole-lecture.webm"\`,
    );
    await page.waitForText("whole-lecture.webm");`;
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
  if (!source.includes(initialReadyBeforeSeed)) {
    throw new Error("The long-media E2E source no longer contains the initial origin boundary.");
  }
  if (!source.includes(earlyHardNavigation)) {
    throw new Error("The long-media E2E source no longer contains the guarded navigation block.");
  }
  if (!source.includes(eagerPromiseBoolean)) {
    throw new Error("The long-media E2E source no longer contains the predicate evaluation block.");
  }
  if (!source.includes(passiveFileInput)) {
    throw new Error("The long-media E2E source no longer contains the passive file-input helper.");
  }
  if (!source.includes(mediaTextWait)) {
    throw new Error("The long-media E2E source no longer contains the selected-media check.");
  }
  if (source.split(transcriptTextWait).length - 1 !== 2) {
    throw new Error("The long-media E2E source no longer contains both transcript text checks.");
  }
  if (!source.includes(transcriptHeadingWait)) {
    throw new Error("The long-media E2E source no longer contains the transcript heading check.");
  }

  const patched = source
    .replace(initialReadyBeforeSeed, explicitOriginBeforeSeed)
    .replace(eagerPromiseBoolean, awaitedPredicate)
    .replace(passiveFileInput, eventfulFileInput)
    .replace(mediaTextWait, mediaInputWait)
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
