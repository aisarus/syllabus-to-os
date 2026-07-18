import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const read = (path) => readFile(resolve(process.cwd(), path), "utf8");
const [route, browser] = await Promise.all([
  read("src/routes/app.exam-engine.tsx"),
  read("scripts/run-canonical-immediate-exam-result-browser-e2e.mjs"),
]);

const failures = [];
const requireMarker = (content, marker, message) => {
  if (!content.includes(marker)) failures.push(message);
};

for (const marker of [
  "dismissedResultIds",
  "!dismissedResultIds.includes(session.id)",
  "current.includes(restoredSession.id)",
  "[...current, restoredSession.id]",
]) {
  requireMarker(route, marker, `Session-scoped result dismissal is missing: ${marker}`);
}

for (const marker of [
  "Previously submitted result",
  "К blueprints",
  "Сдать экзамен",
  "Immediate submit fell back to the legacy inline result",
  "The new submission did not create a second session",
  "Reload restored the older result instead of the newest submission",
  "share the canonical result screen",
]) {
  requireMarker(browser, marker, `Canonical immediate-result proof is missing: ${marker}`);
}

if (failures.length > 0) {
  console.error("Canonical immediate Exam Engine result contract failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Canonical immediate Exam Engine result contract passed.");
