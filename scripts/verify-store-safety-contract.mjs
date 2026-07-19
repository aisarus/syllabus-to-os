import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const read = (path) => readFile(resolve(process.cwd(), path), "utf8");
const [
  appRoute,
  lifecycle,
  installer,
  persistence,
  store,
  storeRuntime,
  integrity,
  evaluation,
  durableEvaluation,
  privateRunner,
  tasks,
  status,
] = await Promise.all([
  read("src/routes/app.tsx"),
  read("src/components/store-safety-lifecycle.tsx"),
  read("src/lib/install-store-safety.ts"),
  read("src/lib/persistence-health.ts"),
  read("src/lib/store.ts"),
  read("src/lib/store-runtime.ts"),
  read("src/lib/source-integrity.ts"),
  read("scripts/run-store-safety-evals.mjs"),
  read("scripts/run-durable-store-evals.mjs"),
  read("scripts/run-private-ocr-provider.mjs"),
  read("TASKS.md"),
  read("STATUS.md"),
]);

const failures = [];
const requireMarker = (content, marker, message) => {
  if (!content.includes(marker)) failures.push(message);
};

requireMarker(appRoute, "<StoreSafetyLifecycle />", "The app shell does not mount store safety.");
for (const marker of [
  "useWorkspacePersistenceFailure",
  "retryPendingWorkspacePersistence",
  "Аварийная JSON-копия",
  "Изменение не применено",
]) {
  requireMarker(lifecycle, marker, `Store safety lifecycle is missing: ${marker}`);
}

// S2-001 will remove this compatibility installer. Until then, keep its existing
// source-integrity behavior covered without treating it as the persistence boundary.
for (const marker of [
  "installStoreSafetyGuards",
  "replaceMaterialChunksWithStableIds",
  "store.replaceMaterialChunksForMaterial",
  "store.updateNote",
]) {
  requireMarker(installer, marker, `Store safety compatibility installer is missing: ${marker}`);
}

for (const marker of [
  "WorkspacePersistenceError",
  "WorkspacePersistenceFailureKind",
  'failureKind: "verification"',
  'failureKind: "serialization"',
  "QuotaExceededError",
  "persistWorkspaceSnapshot",
]) {
  requireMarker(persistence, marker, `Persistence result contract is missing: ${marker}`);
}

for (const marker of [
  "commitWorkspaceCandidate",
  "pendingPersistenceFailure",
  "retryPendingWorkspacePersistence",
  "workspaceStoreTesting",
  "useWorkspacePersistenceFailure",
]) {
  requireMarker(
    storeRuntime,
    marker,
    `Durable-before-publish store contract is missing: ${marker}`,
  );
}
for (const marker of ["./store-runtime.ts", "./store-mutators.ts", "./store-helpers.ts"]) {
  requireMarker(store, marker, `Store facade is missing module export: ${marker}`);
}

const commitStart = storeRuntime.indexOf("function commitWorkspaceCandidate");
const commitEnd = storeRuntime.indexOf("function subscribe(", commitStart);
const commitBody =
  commitStart >= 0 && commitEnd > commitStart ? storeRuntime.slice(commitStart, commitEnd) : "";
const persistIndex = commitBody.indexOf("persistWorkspaceSnapshot");
const failureIndex = commitBody.indexOf("if (!health.ok)");
const publishIndex = commitBody.indexOf("state = next");
const notifyIndex = commitBody.indexOf("notifyDataListeners()");
if (
  !commitBody ||
  persistIndex < 0 ||
  failureIndex < persistIndex ||
  publishIndex < failureIndex ||
  notifyIndex < publishIndex
) {
  failures.push(
    "The core store does not persist and verify a candidate before publishing state and notifying subscribers.",
  );
}
const failureBody =
  failureIndex >= 0 && publishIndex > failureIndex
    ? commitBody.slice(failureIndex, publishIndex)
    : "";
if (failureBody.includes("notifyDataListeners")) {
  failures.push("The failed-write branch still notifies ordinary data subscribers.");
}

for (const marker of [
  "replaceMaterialChunksWithStableIds",
  "repairDanglingSourceReferences",
  "presentationOutlines",
  "sourceChunkIds",
]) {
  requireMarker(integrity, marker, `Source-integrity contract is missing: ${marker}`);
}

for (const marker of [
  "note_unsaved",
  "publishedBeforeFailure",
  "dataNotifications",
  'failureKind === "quota"',
  '"unavailable", "unavailable"',
  '"mismatch", "verification"',
  'failureKind === "serialization"',
  "retryPendingWorkspacePersistence",
]) {
  requireMarker(durableEvaluation, marker, `Store publication regression is missing: ${marker}`);
}

for (const marker of [
  "/api/ai/ocr-image",
  "--require-external-candidates",
  "private-eval-candidates",
  "promptVersion",
]) {
  requireMarker(privateRunner, marker, `Private OCR runner is missing: ${marker}`);
}
requireMarker(tasks, "S1-001", "TASKS.md does not contain S1-001.");
requireMarker(status, "S1-001", "STATUS.md does not record S1-001.");

if (failures.length > 0) {
  console.error("Store safety contract verification failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Store durable-before-publish and source-integrity contract passed.");
