import assert from "node:assert/strict";
import { WorkspacePersistenceError } from "../src/lib/persistence-health.ts";
import { installStoreSafetyGuards } from "../src/lib/install-store-safety.ts";
import {
  getDataSnapshot,
  store,
  subscribeCardReviewEvents,
  workspaceRepository,
  workspaceStoreTesting,
} from "../src/lib/store.ts";

const empty = () => ({
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
});

const now = 1_720_000_000_000;
const linked = {
  ...empty(),
  materials: [
    {
      id: "material_1",
      title: "Source",
      type: "lecture",
      sourceMode: "pasted_text",
      tags: [],
      rawText: "A\nB",
      processingStatus: "ready",
      createdAt: now,
      updatedAt: now,
    },
  ],
  materialChunks: [
    {
      id: "chunk_a",
      materialId: "material_1",
      order: 0,
      text: "A",
      pageNumber: 1,
      section: "ocr:a",
      createdAt: now,
    },
    {
      id: "chunk_b",
      materialId: "material_1",
      order: 1,
      text: "B",
      pageNumber: 2,
      section: "ocr:b",
      createdAt: now,
    },
  ],
  notes: [
    {
      id: "note_1",
      title: "Note",
      content: "A and B",
      tags: [],
      materialId: "material_1",
      sourceChunkIds: ["chunk_a", "chunk_b"],
      createdAt: now,
      updatedAt: now,
    },
  ],
  flashcards: [
    {
      id: "card_1",
      front: "B?",
      back: "B",
      materialId: "material_1",
      sourceChunkIds: ["chunk_b"],
      status: "new",
      dueAt: now,
      interval: 0,
      createdAt: now,
    },
  ],
  quizzes: [{ id: "quiz_1", title: "Quiz", materialId: "material_1", createdAt: now }],
  quizQuestions: [
    {
      id: "question_1",
      quizId: "quiz_1",
      prompt: "A?",
      options: ["A", "B"],
      correctIndex: 0,
      sourceChunkIds: ["chunk_a"],
    },
  ],
  presentationOutlines: [
    {
      id: "outline_1",
      title: "Outline",
      materialId: "material_1",
      slides: [{ id: "slide_1", title: "B", bullets: [], sourceChunkIds: ["chunk_b"], order: 0 }],
      createdAt: now,
      updatedAt: now,
    },
  ],
};

let persisted = JSON.stringify(empty());
let writes = 0;
const workingStorage = {
  getItem: () => persisted,
  setItem: (_key, value) => {
    writes += 1;
    persisted = value;
  },
};
workspaceStoreTesting.reset(empty());
workspaceStoreTesting.setStorage(workingStorage);
let notifications = 0;
const unsubscribe = workspaceRepository.subscribe(() => {
  notifications += 1;
});
await Promise.resolve();
notifications = 0;
const transactionValue = workspaceRepository.transaction((data) => ({
  data: {
    ...data,
    notes: [
      ...data.notes,
      {
        id: "note_transaction",
        title: "Transaction",
        content: "Committed once",
        tags: [],
        createdAt: now,
        updatedAt: now,
      },
    ],
  },
  value: "note_transaction",
}));
assert.equal(transactionValue, "note_transaction");
assert.equal(writes, 1);
assert.equal(notifications, 1);
assert.equal(getDataSnapshot().notes[0].id, "note_transaction");
unsubscribe();

const publishedBeforeFailure = getDataSnapshot();
workspaceStoreTesting.setStorage({
  getItem: () => persisted,
  setItem: () => {
    const error = new Error("Storage quota exceeded");
    error.name = "QuotaExceededError";
    throw error;
  },
});
let failedNotifications = 0;
const unsubscribeFailure = workspaceRepository.subscribe(() => {
  failedNotifications += 1;
});
await Promise.resolve();
failedNotifications = 0;
assert.throws(
  () =>
    workspaceRepository.transaction((data) => {
      data.notes.push({
        id: "note_not_published",
        title: "Not published",
        content: "Candidate only",
        tags: [],
        createdAt: now,
        updatedAt: now,
      });
      return { data, value: "note_not_published" };
    }),
  WorkspacePersistenceError,
);
assert.deepEqual(getDataSnapshot(), publishedBeforeFailure);
assert.equal(failedNotifications, 0);
assert.equal(workspaceRepository.getRecoveryCandidate()?.notes.at(-1)?.id, "note_not_published");
unsubscribeFailure();

workspaceStoreTesting.reset(linked);
workspaceStoreTesting.setStorage(workingStorage);
const methodIdentity = {
  deleteMaterial: store.deleteMaterial,
  deleteMaterialChunk: store.deleteMaterialChunk,
  replaceMaterialChunksForMaterial: store.replaceMaterialChunksForMaterial,
  updateNote: store.updateNote,
};
installStoreSafetyGuards();
await import("../src/lib/source-safe-store.ts");
assert.equal(store.deleteMaterial, methodIdentity.deleteMaterial);
assert.equal(store.deleteMaterialChunk, methodIdentity.deleteMaterialChunk);
assert.equal(
  store.replaceMaterialChunksForMaterial,
  methodIdentity.replaceMaterialChunksForMaterial,
);
assert.equal(store.updateNote, methodIdentity.updateNote);

store.deleteMaterialChunk("chunk_b");
let current = getDataSnapshot();
assert.deepEqual(current.notes[0].sourceChunkIds, ["chunk_a"]);
assert.deepEqual(current.flashcards[0].sourceChunkIds, []);
assert.deepEqual(current.presentationOutlines[0].slides[0].sourceChunkIds, []);

workspaceStoreTesting.reset(linked);
workspaceStoreTesting.setStorage(workingStorage);
const replacement = store.replaceMaterialChunksForMaterial("material_1", [
  { order: 0, text: "A revised", pageNumber: 1, section: "ocr:a" },
]);
current = getDataSnapshot();
assert.equal(replacement[0].id, "chunk_a");
assert.deepEqual(current.notes[0].sourceChunkIds, ["chunk_a"]);
assert.deepEqual(current.flashcards[0].sourceChunkIds, []);
assert.deepEqual(current.presentationOutlines[0].slides[0].sourceChunkIds, []);

workspaceStoreTesting.reset(linked);
workspaceStoreTesting.setStorage(workingStorage);
store.deleteMaterial("material_1");
current = getDataSnapshot();
assert.equal(current.materials.length, 0);
assert.equal(current.materialChunks.length, 0);
assert.equal(current.notes[0].materialId, undefined);
assert.deepEqual(current.notes[0].sourceChunkIds, []);
assert.deepEqual(current.presentationOutlines[0].slides[0].sourceChunkIds, []);

workspaceStoreTesting.reset({
  ...empty(),
  flashcards: [
    {
      id: "card_review_event",
      front: "Question",
      back: "Answer",
      status: "new",
      dueAt: now,
      interval: 0,
      createdAt: now,
    },
  ],
});
workspaceStoreTesting.setStorage(workingStorage);
const cardReviewEvents = [];
const unsubscribeCardReviews = subscribeCardReviewEvents((cardId, quality) => {
  cardReviewEvents.push({ cardId, quality });
});
store.reviewCard("card_review_event", "good");
assert.deepEqual(cardReviewEvents, [{ cardId: "card_review_event", quality: "good" }]);
workspaceStoreTesting.setStorage({
  getItem: () => persisted,
  setItem: () => {
    const error = new Error("Storage quota exceeded");
    error.name = "QuotaExceededError";
    throw error;
  },
});
assert.throws(() => store.reviewCard("card_review_event", "easy"), WorkspacePersistenceError);
assert.deepEqual(cardReviewEvents, [{ cardId: "card_review_event", quality: "good" }]);
unsubscribeCardReviews();

console.log("WorkspaceRepository transactions and import-order-independent source safety passed.");
