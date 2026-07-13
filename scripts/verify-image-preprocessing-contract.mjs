import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const read = (path) => readFile(resolve(process.cwd(), path), "utf8");
const [store, preprocessing, worker, workspace, ocrPanel, checkScript, packageJson, workflow] =
  await Promise.all([
    read("src/lib/visual-source-store.ts"),
    read("src/lib/image-preprocessing.ts"),
    read("src/lib/image-preprocessing.worker.ts"),
    read("src/components/image-preprocessing-workspace.tsx"),
    read("src/components/ocr-review-panel.tsx"),
    read("scripts/check.mjs"),
    read("package.json"),
    read(".github/workflows/ci.yml"),
  ]);

const failures = [];
const requireMarker = (content, marker, message) => {
  if (!content.includes(marker)) failures.push(message);
};

for (const marker of [
  "const DATABASE_VERSION = 2",
  'const PROCESSING_STORE = "imageProcessing"',
  'const PROCESSED_IMAGE_STORE = "processedImages"',
  "StoredImageProcessingState",
  "StoredProcessedVisualSource",
  "putMaterialImageProcessingState",
  "putMaterialProcessedVisualSource",
  "getMaterialOCRImageSource",
  "deleteMaterialImageProcessing",
  "processed.recipeKey === imageProcessingRecipeKey(processing.recipe)",
]) {
  requireMarker(store, marker, `Durable non-destructive image storage is missing: ${marker}`);
}

for (const marker of [
  "IMAGE_PROCESSING_RECIPE_VERSION",
  "DEFAULT_IMAGE_PROCESSING_RECIPE",
  "normalizeImageProcessingRecipe",
  "hasImageProcessingChanges",
  "renderProcessedImage",
  "estimateImageDeskew",
  "MAX_DERIVED_IMAGE_EDGE",
  'imageOrientation: "from-image"',
  "new Worker(new URL",
  "renderProcessedImageOnMainThread",
  "applyImageProcessingPixels",
  "estimateDeskewFromImageData",
]) {
  requireMarker(preprocessing, marker, `Image-processing recipe or renderer is missing: ${marker}`);
}

for (const marker of [
  "OffscreenCanvas",
  'createImageBitmap(request.source, { imageOrientation: "from-image" })',
  'kind === "estimate-deskew"',
  "convertToBlob",
  "estimateDeskewFromImageData",
]) {
  requireMarker(worker, marker, `Worker-backed large-image processing is missing: ${marker}`);
}

for (const marker of [
  "ImagePreprocessingWorkspace",
  "rotateImageRecipe",
  "Auto deskew",
  "Black-and-white mode",
  "Reset to original",
  "Use processed",
  "CropPreview",
  "current version no longer matches the recipe",
  "EXIF orientation is applied while processing",
]) {
  requireMarker(workspace, marker, `Image-preprocessing UI is missing: ${marker}`);
}

for (const marker of [
  "getMaterialOCRImageSource",
  "recognizeImageWithOCR(ocrSource.source.blob",
  "OCR source selected",
  "<ImagePreprocessingWorkspace",
]) {
  requireMarker(ocrPanel, marker, `OCR no longer respects the chosen visual source: ${marker}`);
}

requireMarker(
  checkScript,
  '"verify:image-preprocessing-contract"',
  "npm run check no longer runs the image-preprocessing contract.",
);
requireMarker(
  packageJson,
  '"verify:image-preprocessing-contract"',
  "package.json no longer exposes the image-preprocessing contract.",
);
requireMarker(
  workflow,
  "Verify image preprocessing contract",
  "CI no longer verifies image preprocessing before typecheck/build.",
);

if (failures.length > 0) {
  console.error("Image preprocessing contract verification failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  "Non-destructive image recipes, Worker-backed preprocessing, durable derived previews and selected-source OCR contract passed.",
);
