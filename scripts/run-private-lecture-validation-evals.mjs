import assert from "node:assert/strict";
import {
  characterErrorRate,
  estimateCost,
  evaluateLectureCandidate,
  normalizeTranscript,
  speakerLabelCoverage,
  timestampCoverage,
  timestampViolations,
  uncertainSegmentRatio,
  wordErrorRate,
} from "./private-lecture-validation-metrics.mjs";

assert.equal(normalizeTranscript("שָׁלוֹם, עולם!", "he"), "שלום עולם");
assert.equal(normalizeTranscript("Привет, МИР!", "ru"), "привет мир");
assert.equal(wordErrorRate("один два три", "один два три", "ru"), 0);
assert.equal(wordErrorRate("один два три", "один три", "ru"), 1 / 3);
assert.equal(characterErrorRate("אבג", "אב", "he"), 1 / 3);
assert.equal(
  timestampCoverage(
    [
      { startSeconds: 0, endSeconds: 4 },
      { startSeconds: 3, endSeconds: 7 },
      { startSeconds: 9, endSeconds: 10 },
    ],
    10,
  ),
  0.8,
);
assert.deepEqual(timestampViolations([{ startSeconds: 5, endSeconds: 4 }], 10), [
  "segment 1 has invalid timestamps",
]);
assert.equal(
  speakerLabelCoverage([
    { text: "a", speaker: "S1" },
    { text: "b" },
    { text: "" },
  ]),
  0.5,
);
assert.equal(uncertainSegmentRatio([{ uncertain: true }, { uncertain: false }]), 0.5);
assert.equal(estimateCost(120, 0.01), 0.02);
assert.equal(estimateCost(120, null), null);

const passing = evaluateLectureCandidate({
  reference: "שלום עולם זה שיעור",
  language: "he",
  durationSeconds: 10,
  latencyMs: 5_000,
  requestSpeakerLabels: true,
  segments: [
    { startSeconds: 0, endSeconds: 5, text: "שלום עולם", speaker: "A" },
    { startSeconds: 5, endSeconds: 10, text: "זה שיעור", speaker: "A" },
  ],
  thresholds: {
    maxWer: 0.1,
    maxCer: 0.1,
    minTimestampCoverage: 0.95,
    minSpeakerLabelCoverage: 0.95,
    maxRealtimeFactor: 0.6,
    maxUncertainSegmentRatio: 0.1,
  },
});
assert.equal(passing.passed, true);
assert.equal(passing.failures.length, 0);

const failing = evaluateLectureCandidate({
  reference: "это точная русская лекция",
  language: "ru",
  durationSeconds: 20,
  latencyMs: 30_000,
  requestSpeakerLabels: true,
  segments: [
    { startSeconds: 0, endSeconds: 4, text: "совсем другой текст", uncertain: true },
    { startSeconds: 21, endSeconds: 22, text: "вне диапазона" },
  ],
  thresholds: {
    maxWer: 0.2,
    maxCer: 0.2,
    minTimestampCoverage: 0.8,
    minSpeakerLabelCoverage: 0.5,
    maxRealtimeFactor: 1,
    maxUncertainSegmentRatio: 0.2,
  },
});
assert.equal(failing.passed, false);
for (const fragment of [
  "WER",
  "CER",
  "timestamp coverage",
  "real-time factor",
  "uncertain segment ratio",
  "speaker-label coverage",
  "ends after the declared duration",
]) {
  assert(
    failing.failures.some((failure) => failure.includes(fragment)),
    `Missing expected failure: ${fragment}`,
  );
}

console.log("Private lecture validation metric evaluations passed.");
