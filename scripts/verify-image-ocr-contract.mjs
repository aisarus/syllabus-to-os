import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const read = (path) => readFile(resolve(process.cwd(), path), "utf8");
const [
  visualStore,
  lifecycle,
  appRoute,
  dataRoute,
  intake,
  reviewDialog,
  queue,
  dashboard,
  launcher,
  detailRoute,
  ocrPanel,
  ocrClient,
  ocrServer,
  ocrRoute,
  gemini,
  roadmap,
] = await Promise.all([
  read("src/lib/visual-source-store.ts"),
  read("src/components/visual-source-lifecycle.tsx"),
  read("src/routes/app.tsx"),
  read("src/routes/app.data.tsx"),
  read("src/lib/material-intake.ts"),
  read("src/components/material-intake-review-dialog.tsx"),
  read("src/components/material-intake-queue.tsx"),
  read("src/routes/app.dashboard.tsx"),
  read("src/components/material-intake-route-launcher.tsx"),
  read("src/routes/app.materials_.$materialId.tsx"),
  read("src/components/ocr-review-panel.tsx"),
  read("src/lib/ocr-client.ts"),
  read("src/lib/server/ocr-generation.ts"),
  read("src/routes/api/ai/ocr-image.ts"),
  read("src/lib/server/gemini.ts"),
  read("ROADMAP.md"),
]);

const failures = [];
const requireMarker = (content, marker, message) => {
  if (!content.includes(marker)) failures.push(message);
};
const forbidMarker = (content, marker, message) => {
  if (content.includes(marker)) failures.push(message);
};

for (const marker of [
  'const DATABASE_NAME = "lamdan-visual-sources"',
  'const IMAGE_STORE = "images"',
  'const OCR_STORE = "ocrDrafts"',
  "putMaterialVisualSource",
  "getMaterialVisualSource",
  "putMaterialOCRDraft",
  "getMaterialOCRDraft",
  "deleteMaterialVisualData",
  "clearAllVisualSourceData",
  "pruneVisualSourceData",
  "getVisualSourceStorageStats",
  "MAX_VISUAL_SOURCE_BYTES",
]) {
  requireMarker(visualStore, marker, `Durable visual-source storage is missing: ${marker}`);
}

for (const marker of [
  "export function VisualSourceLifecycle",
  "pruneVisualSourceData(materialIds)",
  "Could not prune orphaned Lamdan visual data",
]) {
  requireMarker(lifecycle, marker, `Visual-source lifecycle cleanup is missing: ${marker}`);
}
requireMarker(
  appRoute,
  "<VisualSourceLifecycle />",
  "The app shell no longer activates visual-source cleanup.",
);

for (const marker of [
  "getVisualSourceStorageStats",
  "clearAllVisualSourceData",
  "исходные фото в неё не входят",
  "original images are not included",
  "JSON-копия их не содержит",
  "source images, processed previews and OCR drafts",
  "IndexedDB",
]) {
  requireMarker(dataRoute, marker, `Data management is not honest about visual sources: ${marker}`);
}

for (const marker of [
  "isVisualSource: boolean",
  "isVisualSourceCandidate",
  "prepareVisualExtraction",
  "putMaterialVisualSource(result.material.id, prepared.sourceFile)",
  'status: "no_text"',
  "Open the material to run OCR and review the transcription",
]) {
  requireMarker(intake, marker, `Image intake lost required behavior: ${marker}`);
}

for (const marker of [
  "prepared.isVisualSource",
  "URL.createObjectURL(item.file)",
  "Сохранить и перейти к OCR",
  "OCR creates a separate editable draft",
]) {
  requireMarker(reviewDialog, marker, `Image intake review lost required behavior: ${marker}`);
}

requireMarker(
  queue,
  "prepareFileIntake(item.file)",
  "Image intake no longer uses the shared queue pipeline.",
);
for (const content of [dashboard, launcher]) {
  requireMarker(content, ".jpg", "A primary intake surface no longer accepts JPEG images.");
  requireMarker(content, ".png", "A primary intake surface no longer accepts PNG images.");
  requireMarker(content, ".webp", "A primary intake surface no longer accepts WebP images.");
}

for (const marker of [
  'createFileRoute("/app/materials_/$materialId")',
  "OCRReviewPanel",
  "MaterialWorkspace",
]) {
  requireMarker(
    detailRoute,
    marker,
    `Material detail route is missing required behavior: ${marker}`,
  );
}
for (const marker of [
  "getMaterialVisualSource",
  "getMaterialOCRDraft",
  "recognizeImageWithOCR",
  "Manual transcription",
  "normalizedMath",
  "uncertainTokens",
  "putMaterialOCRDraft",
  "ocrDraftToChunks",
  "store.replaceMaterialChunksForMaterial",
  "Применить к материалу",
]) {
  requireMarker(ocrPanel, marker, `OCR review workspace is missing required behavior: ${marker}`);
}
forbidMarker(
  ocrPanel,
  "solve the exercise",
  "Client OCR UI must not imply that OCR solves exercises.",
);

for (const marker of [
  "prepareImageDataUrl",
  "MAX_OCR_EDGE",
  'fetch("/api/ai/ocr-image"',
  "normalizeOCRDraft",
]) {
  requireMarker(ocrClient, marker, `OCR client is missing required behavior: ${marker}`);
}

for (const marker of [
  "runOCRGeneration",
  "Transcribe only what is visibly present",
  "Never solve the exercise",
  "normalizedMath",
  "requiresReview=true",
  "A confident invented answer is forbidden",
  "validateOCRDraft",
]) {
  requireMarker(ocrServer, marker, `OCR server trust contract is missing: ${marker}`);
}

requireMarker(ocrRoute, 'createFileRoute("/api/ai/ocr-image")', "OCR API route is missing.");
requireMarker(
  ocrRoute,
  "runOCRGeneration(body)",
  "OCR API route no longer uses the trusted OCR pipeline.",
);

for (const marker of [
  "generateGeminiVisionJSON",
  'type: "image_url"',
  "Unsupported image payload",
]) {
  requireMarker(gemini, marker, `AI gateway multimodal boundary is missing: ${marker}`);
}

for (const marker of [
  "OCR is ingestion, not a late add-on",
  "Phase 1 — Reliable universal intake",
  "Image and OCR intake",
  "Visual-source workspace",
  "basic photo intake, OCR, handwriting review and photographed mathematics belong to Phases 1–2",
  "Store uploaded photographs durably in the browser",
]) {
  requireMarker(roadmap, marker, `Roadmap has not integrated OCR into the core: ${marker}`);
}

if (failures.length > 0) {
  console.error("Image intake and OCR review contract verification failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  "Durable image intake, OCR/HTR review, non-nested material routing, lifecycle cleanup and backup honesty passed.",
);
