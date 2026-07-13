import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const read = (path) => readFile(resolve(process.cwd(), path), "utf8");
const [ocrContract, visualStore, reviewPanel, overlay, checkScript, packageJson, workflow] =
  await Promise.all([
    read("src/lib/ocr-contract.ts"),
    read("src/lib/visual-source-store.ts"),
    read("src/components/ocr-review-panel.tsx"),
    read("src/components/ocr-region-overlay.tsx"),
    read("scripts/check.mjs"),
    read("package.json"),
    read(".github/workflows/ci.yml"),
  ]);

const failures = [];
const requireMarker = (content, marker, message) => {
  if (!content.includes(marker)) failures.push(message);
};

for (const marker of [
  "OCRVisualSourceContext",
  "visualSource?: OCRVisualSourceContext",
  "normalizeOCRBoundingBox",
  "isValidOCRBoundingBox",
  "moveOCRBoundingBox",
  "resizeOCRBoundingBox",
  "box.x + box.width <= 1",
  "box.y + box.height <= 1",
  "manual?: boolean",
]) {
  requireMarker(ocrContract, marker, `OCR coordinates are not durable and normalized: ${marker}`);
}

for (const marker of [
  "getMaterialOCRDraftVisualSource",
  "original.updatedAt !== context.sourceUpdatedAt",
  "processed.recipeKey === context.processedRecipeKey",
  'kind: "processed"; source: StoredProcessedVisualSource',
]) {
  requireMarker(visualStore, marker, `OCR preview can drift from its source raster: ${marker}`);
}

for (const marker of [
  "OCRRegionOverlay",
  "selectedRegionId",
  "hoveredRegionId",
  "visualSourceContextFor(ocrSource)",
  "getMaterialOCRDraftVisualSource",
  "onCreateRegion={createRegionFromOverlay}",
  "id={`ocr-region-editor-${region.id}`}",
  'confirm(isRu ? "Удалить этот OCR-регион?"',
  'dir="ltr"',
]) {
  requireMarker(reviewPanel, marker, `OCR review/text synchronization is incomplete: ${marker}`);
}

for (const marker of [
  "OCRRegionOverlay",
  "regionAtPoint",
  "boxFromPoints",
  "moveOCRBoundingBox",
  "resizeOCRBoundingBox",
  "onPointerDown={startStagePointer}",
  "onPointerMove={moveStagePointer}",
  "onWheel={handleWheel}",
  "resetView",
  'touchAction: mode === "select" ? "pan-y" : "none"',
  'role="button"',
  "onKeyDown",
  "regionStateClass",
  "border-dashed border-yellow-300/90",
  'region.kind === "math"',
]) {
  requireMarker(overlay, marker, `Image overlay interaction or review state is missing: ${marker}`);
}

requireMarker(
  checkScript,
  '"verify:ocr-region-overlay-contract"',
  "npm run check no longer runs the OCR region-overlay contract.",
);
requireMarker(
  packageJson,
  '"verify:ocr-region-overlay-contract"',
  "package.json no longer exposes the OCR region-overlay contract.",
);
requireMarker(
  workflow,
  "Verify OCR region overlay contract",
  "CI no longer verifies OCR region-overlay behavior before typecheck/build.",
);

if (failures.length > 0) {
  console.error("OCR region overlay contract verification failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  "OCR text/image synchronization, source-safe normalized overlays, keyboard interaction and touch-safe region editing contract passed.",
);
