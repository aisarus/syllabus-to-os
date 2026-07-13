import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const read = (path) => readFile(resolve(process.cwd(), path), "utf8");
const [engine, dashboard, styles, roadmap, tasks, status] = await Promise.all([
  read("src/lib/study-command-center.ts"),
  read("src/routes/app.dashboard.tsx"),
  read("src/study-command-center.css"),
  read("ROADMAP.md"),
  read("TASKS.md"),
  read("STATUS.md"),
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

for (const [content, marker, file] of [
  [roadmap, "Academic Autopilot", "ROADMAP.md"],
  [roadmap, "Study Command Center", "ROADMAP.md"],
  [tasks, "P1-011", "TASKS.md"],
  [status, "P1-011", "STATUS.md"],
]) {
  requireMarker(content, marker, `${file} is missing roadmap alignment marker: ${marker}`);
}

if (failures.length > 0) {
  console.error("Study command center contract verification failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Study command center contract passed.");
