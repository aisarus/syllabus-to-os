import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const model = await readFile("src/lib/exam-planning.ts", "utf8");
const store = await readFile("src/lib/exam-planning-store.ts", "utf8");
const panel = await readFile("src/components/exam-planning-panel.tsx", "utf8");
const route = await readFile("src/routes/app.exam-engine.tsx", "utf8");
const evaluations = await readFile("scripts/run-exam-planning-evals.mjs", "utf8");
const browser = await readFile("scripts/run-exam-planning-browser-e2e.mjs", "utf8");
const docs = await readFile("docs/EXAM_PLANNING_V1.md", "utf8");

for (const marker of [
  "MAX_EXAM_PLAN_DAYS = 180",
  "dailyMinutes",
  "sessionMinutes",
  "availableWeekdays",
  "topicWeights",
  "weightedTargets",
  "buildExamStudyPlan",
]) {
  assert(model.includes(marker), `Exam planning model is missing: ${marker}`);
}
assert(store.includes('const KEY = "lamdan.exam-planning.v1"'));
assert(store.includes("saveAndGenerate"));
assert(store.includes("deleteProfile"));
assert(panel.includes("План подготовки"));
assert(panel.includes("Горизонт ограничен 180 днями"));
assert(panel.includes("не будет выдавать план за прогноз оценки или готовности"));
assert(route.includes("ExamPlanningPanel"));
assert(evaluations.includes("topic-a"));
assert(evaluations.includes("availableDates.length, 180"));
assert(browser.includes("lamdan.exam-planning.v1"));
assert(browser.includes("Frozen Exam Engine browser E2E passed"));

console.log("Exam planning contract verified.");
