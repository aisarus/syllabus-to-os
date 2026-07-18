import assert from "node:assert/strict";
import {
  inspectWorkspacePersistence,
  persistWorkspaceSnapshot,
} from "../src/lib/persistence-health.ts";
import {
  getDataSnapshot,
  setData,
  store,
} from "../src/lib/source-safe-store.ts";
import {
  repairDanglingSourceReferences,
  replaceMaterialChunksWithStableIds,
} from "../src/lib/source-integrity.ts";

const now = 1_720_000_000_000;
const base = (overrides = {}) => ({
  version: 1,
  programs: [],
  courses: [],
  topics: [],
  notes: [],
  flashcards: [],
  quizzes: [],
  quizQuestions: [],
  quizAttempts: [],
  assignments: [],
  materials: [],
  materialChunks: [],
  materialOutputs: [],
  presentationOutlines: [],
  calendarEvents: [],
  studySessions: [],
  syllabusImports: [],
  ...overrides,
});

const originalChunks = [
  {
    id: "chunk_heading",
    materialId: "material_1",
    order: 0,
    title: "Heading",
    text: "Old heading",
    pageNumber: 1,
    section: "ocr:heading",
    createdAt: now,
  },
  {
    id: "chunk_math",
    materialId: "material_1",
    order: 1,
    title: "Math",
    text: "x² = 4",
    pageNumber: 1,
    section: "ocr:math",
    createdAt: now,
  },
];
const linked = base({
  materials: [
    {
      id: "material_1",
      title: "Source material",
      type: "lecture",
      sourceMode: "pasted_text",
      tags: [],
      rawText: "Old heading\n\nx² = 4",
      processingStatus: "ready",
      createdAt: now,
      updatedAt: now,
    },
  ],
  materialChunks: originalChunks,
  notes: [
    {
      id: "note_1",
      title: "Note",
      content: "Content",
      tags: [],
      materialId: "material_1",
      sourceChunkIds: ["chunk_heading", "chunk_math"],
      createdAt: now,
      updatedAt: now,
    },
  ],
  flashcards: [
    {
      id: "card_1",
      front: "x?",
      back: "2",
      materialId: "material_1",
      sourceChunkIds: ["chunk_math"],
      status: "new",
      dueAt: now,
      interval: 0,
      createdAt: now,
    },
  ],
  quizzes: [
    {
      id: "quiz_1",
      title: "Quiz",
      materialId: "material_1",
      createdAt: now,
    },
  ],
  quizQuestions: [
    {
      id: "question_1",
      quizId: "quiz_1",
      prompt: "Heading?",
      options: ["A", "B"],
      correctIndex: 0,
      sourceChunkIds: ["chunk_heading"],
    },
  ],
  presentationOutlines: [
    {
      id: "outline_1",
      title: "Outline",
      materialId: "material_1",
      slides: [
        {
          id: "slide_1",
          title: "Math",
          bullets: [],
          sourceChunkIds: ["chunk_math"],
          order: 0,
        },
      ],
      createdAt: now,
      updatedAt: now,
    },
  ],
});

let nextId = 0;
const replacement = replaceMaterialChunksWithStableIds(
  linked,
  "material_1",
  [
    {
      order: 0,
      title: "Heading revised",
      text: "New heading",
      pageNumber: 1,
      section: "ocr:heading",
    },
    {
      order: 1,
      title: "Math revised",
      text: "x^2 = 4",
      pageNumber: 1,
      section: "ocr:math",
    },
  ],
  () => `new_${nextId++}`,
  now + 1,
);
assert.equal(replacement.preservedIds, 2);
assert.deepEqual(
  replacement.chunks.map((chunk) => chunk.id),
  ["chunk_heading", "chunk_math"],
);
assert.deepEqual(replacement.data.notes[0].sourceChunkIds, ["chunk_heading", "chunk_math"]);
assert.deepEqual(replacement.data.presentationOutlines[0].slides[0].sourceChunkIds, [
  "chunk_math",
]);

const legacyCurrent = base({
  ...linked,
  materialChunks: [
    { ...originalChunks[0], id: "new_heading", text: "New heading" },
    { ...originalChunks[1], id: "new_math", text: "x^2 = 4" },
  ],
});
const repaired = repairDanglingSourceReferences(linked, legacyCurrent);
assert.equal(repaired.changed, true);
assert.equal(repaired.remappedIds.chunk_heading, "new_heading");
assert.equal(repaired.remappedIds.chunk_math, "new_math");
assert.deepEqual(repaired.data.notes[0].sourceChunkIds, ["new_heading", "new_math"]);
assert.deepEqual(repaired.data.flashcards[0].sourceChunkIds, ["new_math"]);
assert.deepEqual(repaired.data.quizQuestions[0].sourceChunkIds, ["new_heading"]);
assert.deepEqual(repaired.data.presentationOutlines[0].slides[0].sourceChunkIds, ["new_math"]);

setData(linked);
store.deleteMaterialChunk("chunk_math");
const afterChunkDelete = getDataSnapshot();
assert.deepEqual(afterChunkDelete.notes[0].sourceChunkIds, ["chunk_heading"]);
assert.deepEqual(afterChunkDelete.flashcards[0].sourceChunkIds, []);
assert.deepEqual(afterChunkDelete.quizQuestions[0].sourceChunkIds, ["chunk_heading"]);
assert.deepEqual(afterChunkDelete.presentationOutlines[0].slides[0].sourceChunkIds, []);

setData(linked);
const stableReplacement = store.replaceMaterialChunksForMaterial("material_1", [
  {
    order: 0,
    title: "Heading revised",
    text: "New heading",
    pageNumber: 1,
    section: "ocr:heading",
  },
]);
const afterReplacement = getDataSnapshot();
assert.equal(stableReplacement[0].id, "chunk_heading");
assert.deepEqual(afterReplacement.notes[0].sourceChunkIds, ["chunk_heading"]);
assert.deepEqual(afterReplacement.flashcards[0].sourceChunkIds, []);
assert.deepEqual(afterReplacement.quizQuestions[0].sourceChunkIds, ["chunk_heading"]);
assert.deepEqual(afterReplacement.presentationOutlines[0].slides[0].sourceChunkIds, []);

setData(linked);
store.deleteMaterial("material_1");
const afterMaterialDelete = getDataSnapshot();
assert.equal(afterMaterialDelete.materials.length, 0);
assert.equal(afterMaterialDelete.materialChunks.length, 0);
assert.equal(afterMaterialDelete.notes[0].materialId, undefined);
assert.equal(afterMaterialDelete.flashcards[0].materialId, undefined);
assert.equal(afterMaterialDelete.quizzes[0].materialId, undefined);
assert.equal(afterMaterialDelete.presentationOutlines[0].materialId, undefined);
assert.deepEqual(afterMaterialDelete.notes[0].sourceChunkIds, []);
assert.deepEqual(afterMaterialDelete.flashcards[0].sourceChunkIds, []);
assert.deepEqual(afterMaterialDelete.quizQuestions[0].sourceChunkIds, []);
assert.deepEqual(afterMaterialDelete.presentationOutlines[0].slides[0].sourceChunkIds, []);

let persisted = null;
const workingStorage = {
  getItem: () => persisted,
  setItem: (_key, value) => {
    persisted = value;
  },
};
assert.equal(inspectWorkspacePersistence(linked, workingStorage).ok, false);
assert.equal(persistWorkspaceSnapshot(linked, workingStorage).ok, true);
assert.equal(inspectWorkspacePersistence(linked, workingStorage).ok, true);

const fullStorage = {
  getItem: () => null,
  setItem: () => {
    const error = new Error("Storage quota exceeded");
    error.name = "QuotaExceededError";
    throw error;
  },
};
const failed = persistWorkspaceSnapshot(linked, fullStorage);
assert.equal(failed.ok, false);
assert.match(failed.error, /storage is full/i);

console.log("Store persistence honesty and source-reference integrity evaluations passed.");
