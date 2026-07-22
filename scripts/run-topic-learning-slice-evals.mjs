import assert from "node:assert/strict";
import { normalizeConceptEvidenceData } from "../src/lib/concept-evidence.ts";
import {
  buildRecallTerms,
  buildTopicRecallAttemptKey,
  evaluateTopicRecall,
  normalizeRecallText,
} from "../src/lib/topic-learning-slice.ts";

assert.deepEqual(normalizeRecallText("Судебный контроль — это проверка решений судами."), [
  "судебный",
  "контроль",
  "проверка",
  "решений",
  "судами",
]);

const terms = buildRecallTerms({
  title: "Судебный контроль",
  aliases: ["Judicial review"],
  explanation: "Проверка решений независимыми судами ограничивает исполнительную власть.",
});
assert.ok(terms.includes("судебный"));
assert.ok(terms.includes("контроль"));

const passed = evaluateTopicRecall({
  title: "Судебный контроль",
  aliases: [],
  explanation: "Проверка решений независимыми судами ограничивает исполнительную власть.",
  response: "Судебный контроль — проверка решений независимыми судами.",
});
assert.equal(passed.passed, true);
assert.ok(passed.score >= 50);
assert.ok(passed.matchedTerms.length >= 2);

const failed = evaluateTopicRecall({
  title: "Судебный контроль",
  aliases: [],
  explanation: "Проверка решений независимыми судами ограничивает исполнительную власть.",
  response: "Это важная тема.",
});
assert.equal(failed.passed, false);
assert.ok(failed.score < 50);
assert.ok(failed.missingTerms.includes("судебный"));

const deterministicAgain = evaluateTopicRecall({
  title: "Судебный контроль",
  aliases: [],
  explanation: "Проверка решений независимыми судами ограничивает исполнительную власть.",
  response: "Судебный контроль — проверка решений независимыми судами.",
});
assert.deepEqual(deterministicAgain, passed, "verification must be deterministic for identical input");

const attemptKey = buildTopicRecallAttemptKey(
  "con_loop",
  "Судебный контроль — проверка решений независимыми судами.",
);
assert.equal(
  buildTopicRecallAttemptKey(
    "con_loop",
    "  судебный контроль, проверка решений независимыми судами! ",
  ),
  attemptKey,
  "equivalent normalized responses must map to one persisted attempt",
);
assert.notEqual(
  buildTopicRecallAttemptKey("con_loop", "Судебный контроль ограничивает власть."),
  attemptKey,
  "meaningfully different responses must remain separate attempts",
);

const russianInflection = evaluateTopicRecall({
  title: "Судебный контроль",
  aliases: [],
  explanation: "Независимые суды ограничивают исполнительную власть.",
  response: "Независимыми судами ограничивается исполнительная власть.",
});
assert.equal(russianInflection.passed, true, "Russian inflections should match deterministically");

const englishInflection = evaluateTopicRecall({
  title: "Judicial review",
  aliases: [],
  explanation: "Independent courts limit executive decisions.",
  response: "An independent court limits executive decision making.",
});
assert.equal(englishInflection.passed, true, "English inflections should match deterministically");

const hebrewInflection = evaluateTopicRecall({
  title: "פיקוח שיפוטי",
  aliases: [],
  explanation: "פיקוח שיפוטי מגביל ממשלה.",
  response: "הפיקוח השיפוטי מגבילים את הממשלה.",
});
assert.equal(hebrewInflection.passed, true, "Hebrew prefixes and plurals should match deterministically");

const now = Date.now();
const normalizedEvidence = normalizeConceptEvidenceData({
  version: 1,
  concepts: [
    {
      id: "con_loop",
      courseId: "crs_loop",
      title: "Judicial review",
      aliases: [],
      sourceChunkIds: [],
      flashcardIds: [],
      quizQuestionIds: [],
      createdAt: now,
      updatedAt: now,
    },
  ],
  evidenceEvents: [
    {
      id: "legacy_manual",
      conceptId: "con_loop",
      kind: "explanation",
      outcome: "success",
      sourceType: "manual",
      sourceLabel: "Legacy self-recorded evidence",
      occurredAt: now,
    },
    {
      id: "deterministic_recall",
      conceptId: "con_loop",
      kind: "recall",
      outcome: "success",
      sourceType: "deterministic_recall",
      sourceId: attemptKey,
      sourceLabel: "Deterministic topic recall",
      prompt: "Explain judicial review",
      response: "Independent courts limit executive decisions",
      score: 75,
      occurredAt: now + 1,
    },
  ],
});
assert.deepEqual(
  normalizedEvidence.evidenceEvents.map((event) => event.sourceType),
  ["manual", "deterministic_recall"],
  "legacy manual and new deterministic recall events must both survive normalization",
);

console.log("Topic learning slice deterministic evaluations passed.");
