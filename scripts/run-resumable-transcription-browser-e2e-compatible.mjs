import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const sourcePath = new URL("./run-resumable-transcription-browser-e2e.mjs", import.meta.url);
const temporaryDirectory = await mkdtemp(join(tmpdir(), "lamdan-resumable-compatible-"));
const temporaryScript = join(temporaryDirectory, "run-compatible.mjs");

try {
  const source = await readFile(sourcePath, "utf8");
  const compatible = source
    .replaceAll(
      'indexedDB.open("lamdan-resumable-transcription", 1)',
      'indexedDB.open("lamdan-resumable-transcription")',
    )
    .replaceAll("indexedDB.open(name, 1)", "indexedDB.open(name)")
    .replaceAll("Запустить выбранные диапазоны", "Запустить подготовленные диапазоны")
    .replace(
      '    await page.waitFor("document.readyState === \'complete\'");\n\n    await page.evaluate(`(async () => {',
      '    await page.navigate("/app/dashboard");\n\n    await page.evaluate(`(async () => {',
    );
  await writeFile(temporaryScript, compatible);
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
