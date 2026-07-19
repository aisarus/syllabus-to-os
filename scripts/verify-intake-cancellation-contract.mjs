import { readFile } from "node:fs/promises";

const files = Object.fromEntries(
  await Promise.all(
    [
      "src/components/material-intake-queue.tsx",
      "src/lib/material-intake.ts",
      "src/lib/material-fingerprints.ts",
      "src/lib/document-ingestion.ts",
      "src/lib/ingestion/pdf.ts",
      "src/lib/ingestion/docx.ts",
      "src/lib/ingestion/xlsx.ts",
      "src/lib/intake-cancellation.ts",
    ].map(async (path) => [path, await readFile(path, "utf8")]),
  ),
);
const failures = [];
const requireMarker = (path, marker) => {
  if (!files[path].includes(marker)) failures.push(`${path} is missing ${marker}`);
};

for (const marker of [
  "abortControllersRef",
  "new AbortController()",
  "controller.abort()",
  "prepareFileIntake(item.file, { signal })",
  "fingerprintFile(item.file, signal)",
  'status: cancelled ? "cancelled" : "error"',
]) {
  requireMarker("src/components/material-intake-queue.tsx", marker);
}
requireMarker("src/lib/material-intake.ts", "options: { signal?: AbortSignal }");
requireMarker("src/lib/material-intake.ts", "ingestFile(file, options.signal)");
requireMarker("src/lib/material-fingerprints.ts", "signal?: AbortSignal");
requireMarker("src/lib/document-ingestion.ts", "reader.abort()");
for (const path of [
  "src/lib/ingestion/pdf.ts",
  "src/lib/ingestion/docx.ts",
  "src/lib/ingestion/xlsx.ts",
]) {
  requireMarker(path, "throwIfIntakeCancelled(signal)");
}
requireMarker("src/lib/intake-cancellation.ts", "isIntakeCancellation");

if (failures.length > 0) {
  console.error("Intake cancellation contract failed:\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log("AbortController-backed running intake cancellation contract passed.");
