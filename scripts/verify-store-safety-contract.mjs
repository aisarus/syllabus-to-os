import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const read = (path) => readFile(resolve(process.cwd(), path), "utf8");
const [
  app,
  root,
  lifecycle,
  installer,
  persistence,
  runtime,
  facade,
  mutators,
  repository,
  compatibility,
  safety,
  concept,
  conceptLifecycle,
  durableEval,
  repositoryEval,
] = await Promise.all([
  read("src/routes/app.tsx"),
  read("src/routes/__root.tsx"),
  read("src/components/store-safety-lifecycle.tsx"),
  read("src/lib/install-store-safety.ts"),
  read("src/lib/persistence-health.ts"),
  read("src/lib/store-runtime.ts"),
  read("src/lib/store.ts"),
  read("src/lib/store-mutators.ts"),
  read("src/lib/workspace-repository.ts"),
  read("src/lib/source-safe-store.ts"),
  read("src/lib/source-reference-safety.ts"),
  read("src/lib/concept-store.ts"),
  read("src/components/concept-evidence-lifecycle.tsx"),
  read("scripts/run-durable-store-evals.mjs"),
  read("scripts/run-workspace-repository-evals.mjs"),
]);

const failures = [];
const requireMarker = (content, marker, message) => {
  if (!content.includes(marker)) failures.push(message);
};
const forbidMarker = (content, marker, message) => {
  if (content.includes(marker)) failures.push(message);
};

requireMarker(app, "<StoreSafetyLifecycle />", "App shell does not mount store safety.");
for (const marker of [
  "WorkspacePersistenceError",
  "retryPendingWorkspacePersistence",
  "Emergency JSON",
]) {
  requireMarker(lifecycle, marker, `Store safety UI is missing: ${marker}`);
}
for (const marker of [
  "WorkspacePersistenceFailureKind",
  'failureKind: "verification"',
  'failureKind: "serialization"',
  "persistWorkspaceSnapshot",
]) {
  requireMarker(persistence, marker, `Persistence contract is missing: ${marker}`);
}
for (const marker of [
  "commitWorkspaceData",
  "pendingPersistenceFailure",
  "subscribeWorkspaceData",
  "useWorkspacePersistenceFailure",
]) {
  requireMarker(runtime, marker, `Runtime persistence boundary is missing: ${marker}`);
}

const commitStart = runtime.indexOf("export function commitWorkspaceData");
const commitEnd = runtime.indexOf("export function subscribeWorkspaceData", commitStart);
const commit =
  commitStart >= 0 && commitEnd > commitStart ? runtime.slice(commitStart, commitEnd) : "";
const persist = commit.indexOf("persistWorkspaceSnapshot");
const fail = commit.indexOf("if (!health.ok)");
const publish = commit.indexOf("state = next");
const notify = commit.indexOf("notifyDataListeners()");
if (!commit || persist < 0 || fail < persist || publish < fail || notify < publish) {
  failures.push("Core state is not persisted and verified before publication and notification.");
}

for (const marker of [
  "./store-runtime.ts",
  "./store-mutators.ts",
  "./store-helpers.ts",
  "./workspace-repository.ts",
]) {
  requireMarker(facade, marker, `Store facade is missing: ${marker}`);
}
for (const marker of [
  "export interface WorkspaceRepository",
  "getMutationBase()",
  "replace(next: AppData)",
  "transaction<T>",
  "getRecoveryCandidate()",
  "cloneWorkspaceData",
]) {
  requireMarker(repository, marker, `WorkspaceRepository is missing: ${marker}`);
}
for (const marker of [
  "workspaceRepository.update",
  "workspaceRepository.transaction",
  "deleteMaterialFromWorkspace",
  "replaceMaterialChunksInWorkspace",
  "subscribeCardReviewEvents",
  "notifyCardReview",
]) {
  requireMarker(mutators, marker, `Base mutator boundary is missing: ${marker}`);
}
for (const marker of [
  "scrubSourceChunkReferences",
  "deleteMaterialFromWorkspace",
  "deleteMaterialChunkFromWorkspace",
  "replaceMaterialChunksInWorkspace",
  "presentationOutlines",
]) {
  requireMarker(safety, marker, `Source-reference safety is missing: ${marker}`);
}
for (const marker of ["source-reference-safety.ts", "workspaceRepository", "store"]) {
  requireMarker(compatibility, marker, `Compatibility facade is missing: ${marker}`);
}

forbidMarker(
  lifecycle,
  'import "@/lib/install-store-safety"',
  "Lifecycle still uses an installer side effect.",
);
forbidMarker(
  root,
  'import "@/lib/source-safe-store"',
  "Root still uses a source-safe side effect.",
);
requireMarker(
  installer,
  "Intentionally empty",
  "Compatibility installer is not an explicit no-op.",
);
forbidMarker(installer, 'from "./store', "Compatibility installer still imports the shared store.");

const monkeyPatch = /\bstore\.[A-Za-z_$][\w$]*\s*=/;
for (const [name, content] of [
  ["installer", installer],
  ["compatibility", compatibility],
  ["mutators", mutators],
  ["concept", concept],
]) {
  if (monkeyPatch.test(content)) failures.push(`${name} still replaces a shared store method.`);
}
for (const marker of ["installConceptEvidenceBridge", "subscribeCardReviewEvents"]) {
  requireMarker(concept, marker, `Concept review bridge is missing: ${marker}`);
}
requireMarker(
  conceptLifecycle,
  "useEffect(() => installConceptEvidenceBridge(), [])",
  "Concept review bridge is not registered explicitly.",
);

for (const marker of [
  "note_unsaved",
  "publishedBeforeFailure",
  "dataNotifications",
  'failureKind === "quota"',
  'failureKind === "serialization"',
  "retryPendingWorkspacePersistence",
]) {
  requireMarker(durableEval, marker, `Durable-write regression is missing: ${marker}`);
}
for (const marker of [
  "workspaceRepository.transaction",
  "note_not_published",
  "getRecoveryCandidate",
  "methodIdentity",
  "presentationOutlines",
  "cardReviewEvents",
  "subscribeCardReviewEvents",
]) {
  requireMarker(repositoryEval, marker, `Repository regression is missing: ${marker}`);
}

if (failures.length) {
  console.error("Store safety contract verification failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(
  "WorkspaceRepository, durable persistence and import-order independence contract passed.",
);
