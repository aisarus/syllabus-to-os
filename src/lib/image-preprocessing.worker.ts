/// <reference lib="webworker" />

import {
  applyImageProcessingPixels,
  calculateImageOutputLayout,
  estimateDeskewFromImageData,
  normalizeImageProcessingRecipe,
  outputMimeType,
  type ImageProcessingWorkerRequest,
  type ImageProcessingWorkerResponse,
} from "./image-preprocessing";

self.addEventListener("message", (event: MessageEvent<ImageProcessingWorkerRequest>) => {
  void handleRequest(event.data);
});

async function handleRequest(request: ImageProcessingWorkerRequest): Promise<void> {
  try {
    const recipe = normalizeImageProcessingRecipe(request.recipe);
    const bitmap = await createImageBitmap(request.source, { imageOrientation: "from-image" });
    try {
      if (request.kind === "estimate-deskew") {
        const deskew = await estimateDeskew(bitmap, recipe);
        post({ id: request.id, ok: true, deskew });
        return;
      }

      const layout = calculateImageOutputLayout(bitmap.width, bitmap.height, recipe);
      const canvas = new OffscreenCanvas(layout.width, layout.height);
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Offscreen canvas is not available for image preprocessing.");
      context.save();
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, layout.width, layout.height);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.translate(layout.width / 2, layout.height / 2);
      context.rotate(layout.radians);
      context.drawImage(
        bitmap,
        layout.crop.x,
        layout.crop.y,
        layout.crop.width,
        layout.crop.height,
        -layout.drawWidth / 2,
        -layout.drawHeight / 2,
        layout.drawWidth,
        layout.drawHeight,
      );
      context.restore();
      const imageData = context.getImageData(0, 0, layout.width, layout.height);
      context.putImageData(applyImageProcessingPixels(imageData, recipe), 0, 0);
      const blob = await canvas.convertToBlob({
        type: outputMimeType(request.source, recipe),
        quality:
          request.source.type === "image/png" || recipe.threshold !== null ? undefined : 0.92,
      });
      post({ id: request.id, ok: true, blob, width: layout.width, height: layout.height });
    } finally {
      bitmap.close();
    }
  } catch (error) {
    post({
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function estimateDeskew(
  bitmap: ImageBitmap,
  recipe: ImageProcessingWorkerRequest["recipe"],
): Promise<number> {
  const normalized = normalizeImageProcessingRecipe(recipe);
  const crop = normalized.crop ?? { x: 0, y: 0, width: 1, height: 1 };
  const sourceX = Math.round(crop.x * bitmap.width);
  const sourceY = Math.round(crop.y * bitmap.height);
  const sourceWidth = Math.max(1, Math.round(crop.width * bitmap.width));
  const sourceHeight = Math.max(1, Math.round(crop.height * bitmap.height));
  const scale = Math.min(1, 640 / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Offscreen canvas is not available for deskew detection.");
  context.drawImage(bitmap, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
  return estimateDeskewFromImageData(context.getImageData(0, 0, width, height));
}

function post(message: ImageProcessingWorkerResponse): void {
  self.postMessage(message);
}
