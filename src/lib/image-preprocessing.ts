/**
 * Non-destructive image-preprocessing contract.
 *
 * The original visual source is never touched.  This module only describes a
 * serializable recipe and renders a derived blob on demand (preferably in a
 * worker).  Keeping the recipe small and versioned lets IndexedDB restore a
 * user's edit after a reload without accumulating a history of large copies.
 */

export const IMAGE_PROCESSING_RECIPE_VERSION = 1 as const;
export const MAX_DERIVED_IMAGE_EDGE = 3840;
/** Older browsers use the canvas fallback, so cap work before pixel filters run. */
export const MAX_MAIN_THREAD_DERIVED_IMAGE_EDGE = 2200;

export type ImageSourceSelection = "original" | "processed";

export interface NormalizedImageCrop {
  /** Normalized coordinates in the EXIF-oriented source image, 0..1. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageProcessingRecipe {
  version: typeof IMAGE_PROCESSING_RECIPE_VERSION;
  /** Clockwise quarter turns, stored separately from the fine angle. */
  quarterTurns: number;
  /** Fine clockwise rotation in degrees. */
  rotation: number;
  /** Deskew angle in degrees; automatic deskew writes this same field. */
  deskew: number;
  crop: NormalizedImageCrop | null;
  grayscale: boolean;
  brightness: number;
  contrast: number;
  /** Null disables black-and-white conversion; otherwise 0..255. */
  threshold: number | null;
  /** 0 disables sharpening; 0..1 is a conservative amount. */
  sharpen: number;
}

export interface ProcessedImage {
  blob: Blob;
  width: number;
  height: number;
  recipe: ImageProcessingRecipe;
  renderer: "worker" | "main-thread";
}

export interface ImageProcessingWorkerRequest {
  id: string;
  kind: "render" | "estimate-deskew";
  source: Blob;
  recipe: ImageProcessingRecipe;
}

export interface ImageProcessingWorkerResponse {
  id: string;
  ok: boolean;
  error?: string;
  blob?: Blob;
  width?: number;
  height?: number;
  deskew?: number;
}

export const DEFAULT_IMAGE_PROCESSING_RECIPE: ImageProcessingRecipe = {
  version: IMAGE_PROCESSING_RECIPE_VERSION,
  quarterTurns: 0,
  rotation: 0,
  deskew: 0,
  crop: null,
  grayscale: false,
  brightness: 0,
  contrast: 0,
  threshold: null,
  sharpen: 0,
};

export function normalizeImageProcessingRecipe(
  value: Partial<ImageProcessingRecipe> | null | undefined,
): ImageProcessingRecipe {
  const crop = normalizeCrop(value?.crop);
  return {
    version: IMAGE_PROCESSING_RECIPE_VERSION,
    quarterTurns: modulo(Math.round(asNumber(value?.quarterTurns, 0)), 4),
    rotation: clamp(asNumber(value?.rotation, 0), -15, 15),
    deskew: clamp(asNumber(value?.deskew, 0), -12, 12),
    crop,
    grayscale: Boolean(value?.grayscale),
    brightness: clamp(asNumber(value?.brightness, 0), -100, 100),
    contrast: clamp(asNumber(value?.contrast, 0), -100, 100),
    threshold:
      typeof value?.threshold === "number" ? Math.round(clamp(value.threshold, 0, 255)) : null,
    sharpen: clamp(asNumber(value?.sharpen, 0), 0, 1),
  };
}

export function hasImageProcessingChanges(recipe: Partial<ImageProcessingRecipe>): boolean {
  const normalized = normalizeImageProcessingRecipe(recipe);
  return (
    normalized.quarterTurns !== 0 ||
    normalized.rotation !== 0 ||
    normalized.deskew !== 0 ||
    normalized.crop !== null ||
    normalized.grayscale ||
    normalized.brightness !== 0 ||
    normalized.contrast !== 0 ||
    normalized.threshold !== null ||
    normalized.sharpen !== 0
  );
}

export function imageProcessingRecipeKey(recipe: Partial<ImageProcessingRecipe>): string {
  const normalized = normalizeImageProcessingRecipe(recipe);
  return JSON.stringify(normalized);
}

export function rotateImageRecipe(
  recipe: Partial<ImageProcessingRecipe>,
  direction: "clockwise" | "counterclockwise",
): ImageProcessingRecipe {
  const normalized = normalizeImageProcessingRecipe(recipe);
  return {
    ...normalized,
    quarterTurns: modulo(normalized.quarterTurns + (direction === "clockwise" ? 1 : -1), 4),
  };
}

export async function renderProcessedImage(
  source: Blob,
  recipeInput: Partial<ImageProcessingRecipe>,
): Promise<ProcessedImage> {
  const recipe = normalizeImageProcessingRecipe(recipeInput);
  if (typeof window === "undefined") {
    throw new Error("Image preprocessing is only available in a browser.");
  }

  if (typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined") {
    try {
      const result = await runWorker({
        id: createRequestId(),
        kind: "render",
        source,
        recipe,
      });
      if (!result.blob || !result.width || !result.height) {
        throw new Error("The image worker returned an incomplete processed image.");
      }
      return {
        blob: result.blob,
        width: result.width,
        height: result.height,
        recipe,
        renderer: "worker",
      };
    } catch (workerError) {
      // A graceful main-thread fallback keeps preprocessing available in older
      // Safari / embedded WebView environments. The UI exposes any final error.
      console.warn("Image worker unavailable; using a main-thread fallback.", workerError);
    }
  }

  return renderProcessedImageOnMainThread(source, recipe);
}

export async function estimateImageDeskew(
  source: Blob,
  recipeInput: Partial<ImageProcessingRecipe>,
): Promise<number> {
  const recipe = normalizeImageProcessingRecipe(recipeInput);
  if (typeof window === "undefined") {
    throw new Error("Image deskew is only available in a browser.");
  }

  if (typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined") {
    try {
      const result = await runWorker({
        id: createRequestId(),
        kind: "estimate-deskew",
        source,
        recipe,
      });
      if (typeof result.deskew !== "number") {
        throw new Error("The image worker returned no deskew angle.");
      }
      return clamp(result.deskew, -12, 12);
    } catch (workerError) {
      console.warn("Image worker unavailable; estimating deskew on the main thread.", workerError);
    }
  }

  const decoded = await decodeImage(source);
  try {
    const crop = sourceCrop(decoded.width, decoded.height, recipe.crop);
    const scale = Math.min(1, 640 / Math.max(crop.width, crop.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(crop.width * scale));
    canvas.height = Math.max(1, Math.round(crop.height * scale));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Canvas is not available for deskew detection.");
    context.drawImage(
      decoded.source,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    return estimateDeskewFromImageData(context.getImageData(0, 0, canvas.width, canvas.height));
  } finally {
    decoded.release?.();
  }
}

/**
 * A cheap projection-profile estimate. It intentionally operates on a small
 * raster and only corrects the common phone-photo range, never inventing a
 * large rotation. Text lines produce the strongest horizontal projection.
 */
export function estimateDeskewFromImageData(imageData: ImageData): number {
  const { data, width, height } = imageData;
  if (width < 24 || height < 24) return 0;
  const sampleStep = Math.max(1, Math.floor(Math.max(width, height) / 420));
  let bestAngle = 0;
  let bestScore = Number.NEGATIVE_INFINITY;
  let baselineScore = Number.NEGATIVE_INFINITY;

  for (let angle = -10; angle <= 10.001; angle += 0.5) {
    const radians = (angle * Math.PI) / 180;
    const sin = Math.sin(radians);
    const cos = Math.cos(radians);
    const bucketCount = Math.ceil(Math.abs(width * sin) + Math.abs(height * cos)) + 2;
    const buckets = new Uint16Array(bucketCount);
    const offset = width * Math.max(0, -sin);

    for (let y = 0; y < height; y += sampleStep) {
      for (let x = 0; x < width; x += sampleStep) {
        const pixel = (y * width + x) * 4;
        const luminance =
          data[pixel] * 0.2126 + data[pixel + 1] * 0.7152 + data[pixel + 2] * 0.0722;
        if (luminance > 155) continue;
        const bucket = Math.round(x * sin + y * cos + offset);
        if (bucket >= 0 && bucket < buckets.length && buckets[bucket] < 65535) {
          buckets[bucket] += 1;
        }
      }
    }

    let score = 0;
    for (const bucket of buckets) score += bucket * bucket;
    if (angle === 0) baselineScore = score;
    if (score > bestScore) {
      bestScore = score;
      bestAngle = angle;
    }
  }

  // Avoid introducing a correction when a photograph has no clear line signal.
  if (!Number.isFinite(baselineScore) || bestScore < baselineScore * 1.015) return 0;
  return Math.round(clamp(bestAngle, -10, 10) * 10) / 10;
}

export function calculateImageOutputLayout(
  sourceWidth: number,
  sourceHeight: number,
  recipeInput: Partial<ImageProcessingRecipe>,
  maxOutputEdge = MAX_DERIVED_IMAGE_EDGE,
): {
  crop: { x: number; y: number; width: number; height: number };
  drawWidth: number;
  drawHeight: number;
  width: number;
  height: number;
  radians: number;
} {
  const recipe = normalizeImageProcessingRecipe(recipeInput);
  const crop = sourceCrop(sourceWidth, sourceHeight, recipe.crop);
  const radians = ((recipe.quarterTurns * 90 + recipe.rotation + recipe.deskew) * Math.PI) / 180;
  const naturalWidth =
    Math.abs(crop.width * Math.cos(radians)) + Math.abs(crop.height * Math.sin(radians));
  const naturalHeight =
    Math.abs(crop.width * Math.sin(radians)) + Math.abs(crop.height * Math.cos(radians));
  const scale = Math.min(1, maxOutputEdge / Math.max(naturalWidth, naturalHeight));
  const drawWidth = Math.max(1, crop.width * scale);
  const drawHeight = Math.max(1, crop.height * scale);
  return {
    crop,
    drawWidth,
    drawHeight,
    width: Math.max(
      1,
      Math.ceil(Math.abs(drawWidth * Math.cos(radians)) + Math.abs(drawHeight * Math.sin(radians))),
    ),
    height: Math.max(
      1,
      Math.ceil(Math.abs(drawWidth * Math.sin(radians)) + Math.abs(drawHeight * Math.cos(radians))),
    ),
    radians,
  };
}

export function applyImageProcessingPixels(
  imageData: ImageData,
  recipeInput: Partial<ImageProcessingRecipe>,
): ImageData {
  const recipe = normalizeImageProcessingRecipe(recipeInput);
  const { data, width, height } = imageData;
  const contrastFactor = (259 * (recipe.contrast + 255)) / (255 * (259 - recipe.contrast));
  const brightness = recipe.brightness * 2.55;

  for (let index = 0; index < data.length; index += 4) {
    let red = contrastFactor * (data[index] - 128) + 128 + brightness;
    let green = contrastFactor * (data[index + 1] - 128) + 128 + brightness;
    let blue = contrastFactor * (data[index + 2] - 128) + 128 + brightness;

    if (recipe.grayscale || recipe.threshold !== null) {
      const gray = red * 0.2126 + green * 0.7152 + blue * 0.0722;
      red = gray;
      green = gray;
      blue = gray;
    }
    if (recipe.threshold !== null) {
      const value = red >= recipe.threshold ? 255 : 0;
      red = value;
      green = value;
      blue = value;
    }

    data[index] = clampByte(red);
    data[index + 1] = clampByte(green);
    data[index + 2] = clampByte(blue);
  }

  if (recipe.sharpen > 0) applySharpen(data, width, height, recipe.sharpen);
  return imageData;
}

async function renderProcessedImageOnMainThread(
  source: Blob,
  recipe: ImageProcessingRecipe,
): Promise<ProcessedImage> {
  const decoded = await decodeImage(source);
  try {
    const layout = calculateImageOutputLayout(
      decoded.width,
      decoded.height,
      recipe,
      MAX_MAIN_THREAD_DERIVED_IMAGE_EDGE,
    );
    const canvas = document.createElement("canvas");
    canvas.width = layout.width;
    canvas.height = layout.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Canvas is not available for image preprocessing.");
    drawProcessedImage(context, decoded.source, layout);
    const imageData = context.getImageData(0, 0, layout.width, layout.height);
    context.putImageData(applyImageProcessingPixels(imageData, recipe), 0, 0);
    const blob = await canvasToBlob(canvas, outputMimeType(source, recipe));
    return { blob, width: layout.width, height: layout.height, recipe, renderer: "main-thread" };
  } finally {
    decoded.release?.();
  }
}

export function drawProcessedImage(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  source: CanvasImageSource,
  layout: ReturnType<typeof calculateImageOutputLayout>,
): void {
  context.save();
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, layout.width, layout.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.translate(layout.width / 2, layout.height / 2);
  context.rotate(layout.radians);
  context.drawImage(
    source,
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
}

export function outputMimeType(source: Blob, recipeInput: Partial<ImageProcessingRecipe>): string {
  const recipe = normalizeImageProcessingRecipe(recipeInput);
  if (recipe.threshold !== null || source.type === "image/png") return "image/png";
  return "image/jpeg";
}

function normalizeCrop(value: NormalizedImageCrop | null | undefined): NormalizedImageCrop | null {
  if (!value || typeof value !== "object") return null;
  const x = clamp(asNumber(value.x, 0), 0, 1);
  const y = clamp(asNumber(value.y, 0), 0, 1);
  const width = clamp(asNumber(value.width, 0), 0, 1 - x);
  const height = clamp(asNumber(value.height, 0), 0, 1 - y);
  if (width < 0.03 || height < 0.03) return null;
  return { x, y, width, height };
}

function sourceCrop(
  sourceWidth: number,
  sourceHeight: number,
  crop: NormalizedImageCrop | null,
): { x: number; y: number; width: number; height: number } {
  if (!crop) return { x: 0, y: 0, width: sourceWidth, height: sourceHeight };
  return {
    x: Math.round(crop.x * sourceWidth),
    y: Math.round(crop.y * sourceHeight),
    width: Math.max(1, Math.round(crop.width * sourceWidth)),
    height: Math.max(1, Math.round(crop.height * sourceHeight)),
  };
}

async function decodeImage(source: Blob): Promise<{
  source: CanvasImageSource;
  width: number;
  height: number;
  release?: () => void;
}> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      release: () => bitmap.close(),
    };
  }
  const image = await loadImage(source);
  return { source: image, width: image.naturalWidth, height: image.naturalHeight };
}

function loadImage(source: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(source);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("The browser could not decode this image."));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("The browser could not encode the processed image."));
      },
      type,
      type === "image/jpeg" ? 0.92 : undefined,
    );
  });
}

function applySharpen(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  amount: number,
): void {
  const original = new Uint8ClampedArray(data);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const center = (y * width + x) * 4;
      const north = ((y - 1) * width + x) * 4;
      const south = ((y + 1) * width + x) * 4;
      const west = (y * width + x - 1) * 4;
      const east = (y * width + x + 1) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        const edge =
          original[center + channel] * 5 -
          original[north + channel] -
          original[south + channel] -
          original[west + channel] -
          original[east + channel];
        data[center + channel] = clampByte(original[center + channel] + edge * amount);
      }
    }
  }
}

function runWorker(request: ImageProcessingWorkerRequest): Promise<ImageProcessingWorkerResponse> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./image-preprocessing.worker.ts", import.meta.url), {
      type: "module",
    });
    const dispose = () => worker.terminate();
    worker.onmessage = (event: MessageEvent<ImageProcessingWorkerResponse>) => {
      if (event.data.id !== request.id) return;
      dispose();
      if (event.data.ok) resolve(event.data);
      else reject(new Error(event.data.error ?? "Image worker failed."));
    };
    worker.onerror = () => {
      dispose();
      reject(new Error("Image preprocessing worker could not start."));
    };
    worker.postMessage(request);
  });
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampByte(value: number): number {
  return Math.round(clamp(value, 0, 255));
}

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function createRequestId(): string {
  return `image_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
