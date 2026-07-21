import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const read = (path) => readFile(resolve(process.cwd(), path), "utf8");
const [engine, dashboard, styles, evaluation, packageJson, checkScript, workflow, roadmap] =
  await Promise.all([
    read("src/lib/study-command-center.ts"),
    read("src/routes/app.dashboard.tsx"),
    read("src/study-command-center.css"),
    read("scripts/run-study-command-center-evals.mjs"),
    read("package.json"),
    read("scripts/check.mjs"),
    read(".github/workflows/ci.yml"),
    read("ROADMAP.md"),
  ]);

const failures = [];
const requireMarker = (content, marker, message) => {
  if (!content.includes(marker)) failures.push(message);
};

for (const marker of [
  "buildStudyCommandCenter",
  "buildStudyPlan",
  'kind: "assignment"',
  'kind: "review_cards"',
  'kind: "prepare_exam"',
  'kind: "review_material"',
  'kind: "practice_quiz"',
  'kind: "build_study_pack"',
  "studiedMinutesThisWeek",
]) {
  requireMarker(engine, marker, `Study command engine is missing: ${marker}`);
}

for (const marker of [
  "Академический автопилот",
  "Academic autopilot",
  "buildStudyCommandCenter",
  "buildStudyPlan",
  "Только реальные данные",
  "Real data only",
  "studyBudget",
]) {
  requireMarker(dashboard, marker, `Dashboard command center is missing: ${marker}`);
}

for (const marker of [
  ".cw-command-center",
  ".cw-focus-card",
  ".cw-budget-switcher",
  ".cw-command-metrics",
  "@media (max-width: 760px)",
]) {
  requireMarker(styles, marker, `Study command center styling is missing: ${marker}`);
}

for (const marker of [
  'assert.equal(command.focus.kind, "assignment")',
  'assert.equal(command.focus.urgency, "critical")',
  'assert.equal(command.metrics.dueCards, 12)',
  'assert.ok(command.risks.some((risk) => risk.id === "exam-risk:exam-1"))',
  'assert.equal(command.focus.kind, "build_study_pack")',
  'assert.equal(command.focus.kind, "intake")',
  "assert.ok(plan.reduce((total, item) => total + item.allocatedMinutes, 0) <= 20)",
  'assert.equal(plan[0].action.id, "long")',
]) {
  requireMarker(evaluation, marker, `Study command evaluation is missing: ${marker}`);
}

for (const marker of ['"eval:study-command"', '"verify:study-command-center-contract"']) {
  requireMarker(packageJson, marker, `package.json is missing: ${marker}`);
}
for (const marker of ["verify:study-command-center-contract", "eval:study-command"]) {
  requireMarker(checkScript, marker, `npm run check is missing: ${marker}`);
}
for (const marker of [
  "Verify study command center contract",
  "Run study command center evaluations",
]) {
  requireMarker(workflow, marker, `CI is missing: ${marker}`);
}
for (const marker of ["Academic Autopilot", "Study Command Center", "P1-011"]) {
  requireMarker(roadmap, marker, `ROADMAP.md is missing product intent marker: ${marker}`);
}

if (failures.length > 0) {
  console.error("Study command center contract verification failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  "Study command center engine, dashboard, responsive styling, executable scenarios and CI wiring are present.",
);
