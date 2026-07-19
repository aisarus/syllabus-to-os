import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const read = (path) => readFile(resolve(process.cwd(), path), "utf8");
const [
  appRoute,
  lifecycle,
  store,
  repository,
  compatibility,
  persistence,
  integrity,
  privateRunner,
  tasks,
  status,
] = await Promise.all([
  read("src/routes/app.tsx"),
  read("src/components/store-safety-lifecycle.tsx"),
  read("src/lib/store.ts"),
  read("src/lib/workspace-repository.ts"),
  read("src/lib/install-store-safety.ts"),
  read("src/lib/persistence-health.ts"),
  read("src/lib/source-integrity.ts"),
  read("scripts/run-private-ocr-provider.mjs"),
  read("TASKS.md"),
  read("STATUS.md"),
]);

const failures = [];
const requireMarker = (content, marker, message) => {
  if (!content.includes(marker)) failures.push(message);
};
const forbidMarker = (content, marker, message) => {
  if (content.includes(marker)) failures.push(message);
};

requireMarker(
  appRoute,
  "<StoreSafetyLifecycle />",
  "The app shell does not mount persistence health UI.",
);
for (const marker of [
  "inspectWorkspacePersistence",
  "persistWorkspaceSnapshot",
  "repairDanglingSourceReferences",
  "Аварийная JSON-копия",
]) {
  requireMarker(lifecycle, marker, `Store safety lifecycle is missing: ${marker}`);
}
for (const marker of [
  "commitWorkspaceData",
  "WorkspacePersistenceError",
  "persistWorkspaceSnapshot",
  "scrubSourceChunkReferences",
  "replaceMaterialChunksWithStableIds",
]) {
  requireMarker(store, marker, `Base store durable/source-safe contract is missing: ${marker}`);
}
for (const marker of ["WorkspaceRepository", "LocalWorkspaceRepository", "transact", "snapshot"]) {
  requireMarker(repository, marker, `Workspace repository contract is missing: ${marker}`);
}
forbidMarker(
  compatibility,
  "store.updateNote =",
  "Compatibility module still monkey-patches updateNote.",
);
forbidMarker(
  compatibility,
  "store.replaceMaterialChunksForMaterial =",
  "Compatibility module still monkey-patches chunk replacement.",
);
for (const marker of [
  "LAMDAN_DATA_STORAGE_KEY",
  "QuotaExceededError",
  "inspectWorkspacePersistence",
]) {
  requireMarker(persistence, marker, `Persistence honesty contract is missing: ${marker}`);
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
  "/api/ai/ocr-image",
  "--require-external-candidates",
  "private-eval-candidates",
  "promptVersion",
]) {
  requireMarker(privateRunner, marker, `Private OCR runner is missing: ${marker}`);
}
requireMarker(tasks, "PROD-001", "TASKS.md does not contain the production persistence pass.");
requireMarker(
  status,
  "Production Phase 1",
  "STATUS.md does not record the production stabilization pass.",
);

if (failures.length > 0) {
  console.error("Store safety contract verification failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Durable workspace repository and source-integrity contract passed.");
