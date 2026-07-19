import assert from "node:assert/strict";
import { WorkspacePersistenceError } from "../src/lib/persistence-health.ts";
import {
  getDataSnapshot,
  getPendingWorkspacePersistenceFailure,
  retryPendingWorkspacePersistence,
  setData,
  updateData,
  workspaceStoreTesting,
} from "../src/lib/source-safe-store.ts";

const now = Date.now();
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

let storedWorkspace = null;
let storageMode = "working";
const runtimeStorage = {
  getItem: () =>
    storageMode === "mismatch" && storedWorkspace !== null
      ? `${storedWorkspace}corrupt`
      : storedWorkspace,
  setItem: (_key, value) => {
    if (storageMode === "quota") {
      const error = new Error("Storage quota exceeded");
      error.name = "QuotaExceededError";
      throw error;
    }
    if (storageMode === "unavailable") {
      const error = new Error("Browser storage access denied");
      error.name = "SecurityError";
      throw error;
    }
    storedWorkspace = value;
  },
};

workspaceStoreTesting.reset(empty());
workspaceStoreTesting.setStorage(runtimeStorage);
setData(empty());
const publishedBeforeFailure = getDataSnapshot();
let dataNotifications = 0;
let failureNotifications = 0;
const unsubscribeData = workspaceStoreTesting.subscribe(() => {
  dataNotifications += 1;
});
const unsubscribeFailure = workspaceStoreTesting.subscribePersistenceFailure(() => {
  failureNotifications += 1;
});
await Promise.resolve();
dataNotifications = 0;
failureNotifications = 0;

storageMode = "quota";
assert.throws(
  () =>
    updateData((data) => ({
      ...data,
      notes: [
        ...data.notes,
        {
          id: "note_unsaved",
          title: "Unsaved recovery note",
          content: "This candidate must not publish before durable confirmation.",
          tags: [],
          createdAt: now,
          updatedAt: now,
        },
      ],
    })),
  (error) => error instanceof WorkspacePersistenceError && error.health.failureKind === "quota",
);
assert.deepEqual(getDataSnapshot(), publishedBeforeFailure);
assert.equal(dataNotifications, 0);
assert.equal(failureNotifications, 1);
const quotaFailure = getPendingWorkspacePersistenceFailure();
assert.equal(quotaFailure?.health.failureKind, "quota");
assert.equal(quotaFailure?.candidate.notes.at(-1)?.id, "note_unsaved");
assert.match(quotaFailure?.health.serialized ?? "", /note_unsaved/);

assert.throws(
  () =>
    updateData((data) => ({
      ...data,
      assignments: [
        ...data.assignments,
        {
          id: "assignment_unsaved",
          title: "Second unsaved operation",
          status: "not_started",
          priority: "medium",
          createdAt: now,
        },
      ],
    })),
  (error) => error instanceof WorkspacePersistenceError && error.health.failureKind === "quota",
);
assert.deepEqual(getDataSnapshot(), publishedBeforeFailure);
assert.equal(dataNotifications, 0);
assert.equal(failureNotifications, 2);
assert.equal(getPendingWorkspacePersistenceFailure()?.candidate.notes.at(-1)?.id, "note_unsaved");
assert.equal(
  getPendingWorkspacePersistenceFailure()?.candidate.assignments.at(-1)?.id,
  "assignment_unsaved",
);

storageMode = "working";
const retryResult = retryPendingWorkspacePersistence();
assert.equal(retryResult?.ok, true);
assert.equal(getDataSnapshot().notes.at(-1)?.id, "note_unsaved");
assert.equal(getDataSnapshot().assignments.at(-1)?.id, "assignment_unsaved");
assert.equal(dataNotifications, 1);
assert.equal(failureNotifications, 3);
assert.equal(getPendingWorkspacePersistenceFailure(), null);
assert.equal(storedWorkspace, JSON.stringify(getDataSnapshot()));

const assertRejectedWithoutPublication = (mode, expectedKind) => {
  const before = getDataSnapshot();
  dataNotifications = 0;
  failureNotifications = 0;
  storageMode = mode;
  assert.throws(
    () => updateData((data) => ({ ...data, courses: [...data.courses] })),
    (error) =>
      error instanceof WorkspacePersistenceError && error.health.failureKind === expectedKind,
  );
  assert.deepEqual(getDataSnapshot(), before);
  assert.equal(dataNotifications, 0);
  assert.equal(failureNotifications, 1);
};

assertRejectedWithoutPublication("unavailable", "unavailable");
assertRejectedWithoutPublication("mismatch", "verification");

storageMode = "working";
retryPendingWorkspacePersistence();
const beforeSerializationFailure = getDataSnapshot();
const circularCandidate = { ...beforeSerializationFailure };
circularCandidate.notes = circularCandidate;
dataNotifications = 0;
failureNotifications = 0;
assert.throws(
  () => updateData(() => circularCandidate),
  (error) =>
    error instanceof WorkspacePersistenceError && error.health.failureKind === "serialization",
);
assert.deepEqual(getDataSnapshot(), beforeSerializationFailure);
assert.equal(dataNotifications, 0);
assert.equal(failureNotifications, 1);
assert.equal(getPendingWorkspacePersistenceFailure()?.health.serialized, "");

unsubscribeData();
unsubscribeFailure();
workspaceStoreTesting.reset();
console.log("Durable-before-publish core store evaluations passed.");
