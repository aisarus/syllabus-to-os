import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const runner = await readFile("scripts/run-private-lecture-validation.mjs", "utf8");
const metrics = await readFile("scripts/private-lecture-validation-metrics.mjs", "utf8");
const evaluations = await readFile("scripts/run-private-lecture-validation-evals.mjs", "utf8");
const docs = await readFile("docs/PRIVATE_LECTURE_VALIDATION.md", "utf8");
const example = JSON.parse(await readFile("evals/private-lecture-manifest.example.json", "utf8"));
const gitignore = await readFile(".gitignore", "utf8");

for (const marker of [
  "lamdan-private-lecture-candidate",
  "referenceFile",
  "candidateFile",
  "require-languages",
  "private-eval-reports",
  "evaluateLectureCandidate",
  "estimatedCostUsd",
]) {
  assert(runner.includes(marker), `Lecture quality runner is missing: ${marker}`);
}
for (const marker of [
  "normalizeTranscript",
  "wordErrorRate",
  "characterErrorRate",
  "timestampCoverage",
  "speakerLabelCoverage",
  "uncertainSegmentRatio",
  "realtimeFactor",
]) {
  assert(metrics.includes(marker), `Lecture quality metrics are missing: ${marker}`);
}
assert(evaluations.includes("שָׁלוֹם"));
assert(evaluations.includes("русская лекция"));
assert(docs.includes("existing explicit-consent UI"));
assert(
  docs.includes(
    "Passing synthetic metric tests proves the evaluator, not real transcription quality",
  ),
);
assert(gitignore.includes("private-lecture-assets/"));
assert(gitignore.includes("private-eval-reports/"));
assert.equal(example.version, 1);
assert(example.fixtures.some((fixture) => fixture.language === "he"));
assert(example.fixtures.some((fixture) => fixture.language === "ru"));
assert(example.fixtures.every((fixture) => fixture.thresholds));

console.log("Lecture quality validation contract verified.");
