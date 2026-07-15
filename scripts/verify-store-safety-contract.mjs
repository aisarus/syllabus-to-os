import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const read = (path) => readFile(resolve(process.cwd(), path), "utf8");
const [appRoute, lifecycle, installer, persistence, integrity, privateRunner, tasks, status] =
  await Promise.all([
    read("src/routes/app.tsx"),
    read("src/components/store-safety-lifecycle.tsx"),
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

requireMarker(appRoute, "<StoreSafetyLifecycle />", "The app shell does not mount store safety.");
for (const marker of [
  "inspectWorkspacePersistence",
  "persistWorkspaceSnapshot",
  "repairDanglingSourceReferences",
  "Аварийная JSON-копия",
]) {
  requireMarker(lifecycle, marker, `Store safety lifecycle is missing: ${marker}`);
}
for (const marker of [
  "installStoreSafetyGuards",
  "replaceMaterialChunksWithStableIds",
  "store.replaceMaterialChunksForMaterial",
  "store.updateNote",
]) {
  requireMarker(installer, marker, `Store safety installer is missing: ${marker}`);
}
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
requireMarker(tasks, "P1-005", "TASKS.md does not contain the store-safety milestone.");
requireMarker(status, "P1-005", "STATUS.md does not record the store-safety milestone.");

if (failures.length > 0) {
  console.error("Store safety contract verification failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Store persistence and source-integrity contract passed.");
