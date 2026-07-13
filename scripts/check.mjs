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
  "eval",
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
