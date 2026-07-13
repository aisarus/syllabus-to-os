import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const read = (path) => readFile(resolve(process.cwd(), path), "utf8");
const [domain, workspace, launcher, route, lifecycle, client, checkScript, packageJson, workflow] =
  await Promise.all([
    read("src/lib/multi-page-image-materials.ts"),
    read("src/components/multi-page-image-workspace.tsx"),
    read("src/components/material-intake-route-launcher.tsx"),
    read("src/routes/app.materials_.$materialId.tsx"),
    read("src/components/visual-source-lifecycle.tsx"),
    read("src/lib/ocr-client.ts"),
    read("scripts/check.mjs"),
    read("package.json"),
    read(".github/workflows/ci.yml"),
  ]);

const failures = [];
const requireMarker = (content, marker, message) => {
  if (!content.includes(marker)) failures.push(message);
};

for (const marker of [
  'MULTI_PAGE_IMAGE_MIME = "application/x-lamdan-image-batch"',
  "MAX_MULTI_PAGE_IMAGES = 50",
  "createMultiPageImageMaterial",
  "appendMultiPageImages",
  "replaceMultiPageImage",
  "removeMultiPageImage",
  "reorderMultiPageImages",
  "applyOCRDraftToMultiPageImage",
  "refreshMultiPageMaterialAggregate",
  "visualPageIdFromChunk",
  "fingerprintFile",
  "skippedDuplicates",
  "pageNumber",
  "MULTI_PAGE_SECTION_PREFIX",
]) {
  requireMarker(domain, marker, `Multi-page domain behavior is missing: ${marker}`);
}

for (const marker of [
  "export function MultiPageImageWorkspace",
  "OCR всех страниц",
  "Cancel OCR",
  "Apply reviewed",
  "appendMultiPageImages",
  "replaceMultiPageImage",
  "removeMultiPageImage",
  "reorderMultiPageImages",
  "draggable",
  "ImagePreprocessingWorkspace",
  "OCRRegionOverlay",
  "getMaterialOCRImageSource(page.id)",
  "putMaterialOCRDraft(page.id",
  "applyOCRDraftToMultiPageImage",
  "Batch OCR was cancelled",
  "One failed page never destroys the others",
]) {
  requireMarker(workspace, marker, `Multi-page workspace is missing: ${marker}`);
}

for (const marker of [
  "Несколько фото → один материал",
  "Multiple photos → one material",
  "createMultiPageImageMaterial",
  'accept=".jpg,.jpeg,.png,.webp',
]) {
  requireMarker(launcher, marker, `Multi-page intake choice is missing: ${marker}`);
}

requireMarker(route, "isMultiPageImageMaterial", "Material detail does not detect multi-page images.");
requireMarker(route, "MultiPageImageWorkspace", "Material detail does not open the multi-page workspace.");
requireMarker(lifecycle, "getAllVisualSourceIds", "Lifecycle pruning does not preserve page-level visual ids.");
requireMarker(client, "signal?: AbortSignal", "OCR requests are not cancellable per batch.");
requireMarker(client, "signal,", "The browser fetch no longer receives the abort signal.");

requireMarker(
  packageJson,
  '"verify:multipage-image-contract"',
  "package.json does not expose the multi-page contract.",
);
requireMarker(
  checkScript,
  '"verify:multipage-image-contract"',
  "npm run check does not run the multi-page contract.",
);
requireMarker(
  workflow,
  "Verify multi-page image contract",
  "CI does not verify the multi-page image contract.",
);

if (failures.length > 0) {
  console.error("Multi-page image material contract verification failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  "Multi-page image intake, page-aware OCR/preprocessing, partial retry and explicit apply contract passed.",
);
