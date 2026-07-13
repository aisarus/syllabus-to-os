import assert from "node:assert/strict";
import {
  buildStudyPackNoteContent,
  collectStudyPackSourceIds,
  studyPackCopyText,
  validateStudyPackDraft,
} from "../src/lib/study-pack.ts";

const validDraft = {
  title: "Lecture 4 Study Pack",
  orientation: "This lecture explains precision and recall.",
  orientationSourceChunkIds: ["chunk-a"],
  estimatedMinutes: 32,
  steps: [
    {
      title: "Orient",
      purpose: "Understand the relationship between the two measures.",
      durationMinutes: 5,
      activity: "orient",
      sourceChunkIds: ["chunk-a"],
    },
    {
      title: "Practice",
      purpose: "Distinguish precision from recall in examples.",
      durationMinutes: 12,
      activity: "practice",
      sourceChunkIds: ["chunk-a", "chunk-b"],
    },
  ],
  note: {
    title: "Precision and recall",
    content: "Precision measures relevant retrieved items among retrieved items.",
    sourceChunkIds: ["chunk-a"],
  },
  keyTerms: [
    {
      term: "Precision",
      explanation: "Relevant retrieved divided by retrieved.",
      sourceChunkIds: ["chunk-a"],
    },
  ],
  cards: [
    {
      front: "What does precision measure?",
      back: "The share of retrieved items that are relevant.",
      sourceChunkIds: ["chunk-a"],
    },
  ],
  questions: [
    {
      prompt: "Which description matches precision?",
      options: ["Relevant among retrieved", "Retrieved among relevant", "All relevant", "All retrieved"],
      correctIndex: 0,
      explanation: "The source defines precision using retrieved items as the denominator.",
      sourceChunkIds: ["chunk-a"],
    },
  ],
  unclearAreas: [
    {
      description: "The lecture does not provide a worked numeric example.",
      sourceChunkIds: ["chunk-b"],
    },
  ],
  warnings: [],
  notFoundInSources: false,
};

{
  assert.deepEqual(validateStudyPackDraft(validDraft), []);
}

{
  const invalidDraft = structuredClone(validDraft);
  invalidDraft.questions[0].options = ["same", "same", "third", "fourth"];
  assert.ok(validateStudyPackDraft(invalidDraft).includes("question:0"));
}

{
  assert.deepEqual(collectStudyPackSourceIds(validDraft), ["chunk-a", "chunk-b"]);
}

{
  const note = buildStudyPackNoteContent(validDraft, "en");
  assert.match(note, /Study route/);
  assert.match(note, /Key terms/);
  assert.match(note, /does not automatically prove mastery/);
  const copy = studyPackCopyText(validDraft, "en");
  assert.match(copy, /Diagnostic questions/);
  assert.match(copy, /Answer: Relevant among retrieved/);
}

console.log("Study Pack evaluations passed (4 scenarios).");
