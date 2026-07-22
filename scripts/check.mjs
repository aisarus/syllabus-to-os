import { spawnSync } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const directChecks = ["scripts/verify-course-workspace-accessibility-patterns.mjs"];
const checks = [
  "verify:docs",
  "verify:ai-source-contract",
  "verify:syllabus-review-contract",
  "verify:course-workspace-contract",
  "verify:notes-editor-contract",
  "verify:flashcard-studio-contract",
  "verify:quiz-studio-contract",
  "verify:detail-route-contract",
  "verify:core-ui-audit",
  "verify:app-shell-accessibility-contract",
  "verify:evaluation-fixtures",
  "verify:image-ocr-contract",
  "eval:ocr-cancellation",
  "verify:image-preprocessing-contract",
  "verify:ocr-region-overlay-contract",
  "verify:visual-backup-contract",
  "verify:workspace-backup-contract",
  "verify:multipage-image-contract",
  "verify:golden-quiz-quality-contract",
  "verify:critical-browser-e2e-contract",
  "verify:global-search-v2-contract",
  "verify:store-safety-contract",
  "verify:study-command-center-contract",
  "verify:study-pack-contract",
  "verify:concept-evidence-contract",
  "verify:concept-extraction-contract",
  "verify:open-answer-evidence-contract",
  "verify:per-question-evidence-contract",
  "verify:long-media-contract",
  "verify:automatic-transcription-contract",
  "verify:resumable-transcription-contract",
  "verify:local-range-extraction-contract",
  "verify:lecture-backup-contract",
  "verify:lecture-restore-contract",
  "verify:pilot-harness",
  "verify:exam-planning-contract",
  "eval",
  "eval:golden-quiz",
  "eval:global-search",
  "eval:store-safety",
  "eval:study-command",
  "eval:study-pack",
  "eval:concept-evidence",
  "eval:concept-extraction",
  "eval:open-answer-evidence",
  "eval:per-question-evidence",
  "eval:visual-backup",
  "eval:workspace-backup",
  "eval:long-media",
  "eval:automatic-transcription",
  "eval:resumable-transcription",
  "eval:local-range-extraction",
  "eval:lecture-backup",
  "eval:lecture-restore",
  "eval:pilot-preflight",
  "eval:exam-planning",
  "typecheck",
  "lint",
  "build",
];

for (const scriptPath of directChecks) {
  console.log(`\n==> node ${scriptPath}`);
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });

  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

for (const script of checks) {
  console.log(`\n==> npm run ${script}`);
  const result = spawnSync(npmCommand, ["run", script], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });

  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("\nAll Lamdan checks passed.");
