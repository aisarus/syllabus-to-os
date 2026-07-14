import { spawnSync } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
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
  "verify:evaluation-fixtures",
  "verify:image-ocr-contract",
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
  "typecheck",
  "lint",
  "build",
];

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
