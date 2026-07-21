import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const read = (path) => readFile(resolve(process.cwd(), path), "utf8");
const [runner, appShellRunner, wrapper, packageJson, checkScript, workflow, status] =
  await Promise.all([
    read("scripts/run-critical-browser-e2e.mjs"),
    read("scripts/run-app-shell-accessibility-browser-e2e.mjs"),
    read("scripts/run-critical-browser-e2e-wrapper.mjs"),
    read("package.json"),
    read("scripts/check.mjs"),
    read(".github/workflows/ci.yml"),
    read("STATUS.md"),
  ]);

const failures = [];
const requireMarker = (content, marker, message) => {
  if (!content.includes(marker)) failures.push(message);
};

for (const marker of [
  "flowMaterialRoute",
  "flowPhotoManualOcr",
  "flowFlashcards",
  "flowQuiz",
  "flowBackupRestore",
  "Browser.setDownloadBehavior",
  "Page.captureScreenshot",
  "critical-e2e-artifacts",
  "acceptNextDialog",
  "All critical browser flows passed in real Chromium.",
]) {
  requireMarker(runner, marker, `Critical browser runner is missing: ${marker}`);
}

for (const marker of [
  "Emulation.setDeviceMetricsOverride",
  'width: 390',
  'height: 844',
  'Input.dispatchKeyEvent',
  'document.activeElement?.classList.contains(\'content-skip-link\')',
  "lamdan-main-content",
  "lamdan-mobile-navigation",
  'await page.key("Tab", 8)',
  'await page.key("Escape")',
  "focus restoration",
  "app-shell-e2e-artifacts",
]) {
  requireMarker(appShellRunner, marker, `AppShell browser runner is missing: ${marker}`);
}

for (const marker of [
  'import("./run-app-shell-accessibility-browser-e2e.mjs")',
  'import("./run-critical-browser-e2e.mjs")',
  "LAM_DAN_E2E_TIMEOUT_MS",
  "process.exit(process.exitCode ?? 0)",
]) {
  requireMarker(wrapper, marker, `Bounded browser entrypoint is missing: ${marker}`);
}

requireMarker(
  packageJson,
  '"e2e:critical": "node scripts/run-critical-browser-e2e-wrapper.mjs"',
  "package.json does not expose the bounded critical browser runner.",
);
requireMarker(
  packageJson,
  '"verify:critical-browser-e2e-contract"',
  "package.json does not expose the browser E2E contract.",
);
requireMarker(
  checkScript,
  '"verify:critical-browser-e2e-contract"',
  "npm run check does not verify the browser E2E contract.",
);
for (const marker of [
  "Verify critical browser E2E contract",
  "Run critical browser E2E",
  "npm run e2e:critical",
  "critical-e2e-output.txt",
  "critical-e2e-artifacts",
]) {
  requireMarker(workflow, marker, `CI does not preserve the critical browser gate: ${marker}`);
}
requireMarker(
  status,
  "critical browser end-to-end",
  "STATUS.md does not record the critical browser execution target.",
);

if (failures.length > 0) {
  console.error("Critical browser E2E contract verification failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  "Critical AppShell keyboard, material, OCR, flashcard, quiz and full-backup browser flows are wired to bounded real-Chromium execution with failure artifacts.",
);
