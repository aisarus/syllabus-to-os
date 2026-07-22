import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const read = (path) => readFile(resolve(process.cwd(), path), "utf8");
const [engine, ui, evals, browser, workflow] = await Promise.all([
  read("src/lib/topic-learning-slice.ts"),
  read("src/components/topic-learning-slice.tsx"),
  read("scripts/run-topic-learning-slice-evals.mjs"),
  read("scripts/run-topic-learning-slice-browser-e2e.mjs"),
  read(".github/workflows/topic-learning-slice.yml"),
]);

const failures = [];
const requireMarker = (content, marker, message) => {
  if (!content.includes(marker)) failures.push(message);
};

for (const marker of ["buildTopicRecallAttemptKey", "topic-recall:", "Math.imul"]) {
  requireMarker(engine, marker, `Topic recall attempt key is missing: ${marker}`);
}
for (const marker of ["alreadyRecorded", "event.sourceId === sourceId", "if (alreadyRecorded) return"]) {
  requireMarker(ui, marker, `Topic recall idempotent persistence is missing: ${marker}`);
}
for (const marker of [
  "equivalent normalized responses must map to one persisted attempt",
  "meaningfully different responses must remain separate attempts",
]) {
  requireMarker(evals, marker, `Topic recall idempotency evaluation is missing: ${marker}`);
}
for (const marker of [
  "Runtime.exceptionThrown",
  "Log.entryAdded",
  "Network.loadingFailed",
  "Repeated verification of the same response must remain one evidence event",
  "Browser errors detected",
  "Failed network requests detected",
]) {
  requireMarker(browser, marker, `Topic recall browser proof is missing: ${marker}`);
}
for (const marker of [
  "Run deterministic topic learning evaluations",
  "Run topic learning browser E2E",
]) {
  requireMarker(workflow, marker, `Permanent topic learning workflow is missing: ${marker}`);
}

if (failures.length > 0) {
  console.error("Topic learning idempotency contract failed:\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Topic learning idempotency, browser diagnostics and permanent workflow wiring are present.");
