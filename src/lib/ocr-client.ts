import {
  normalizeOCRDraft,
  type OCRDraft,
  type OCRSourceStyle,
} from "./ocr-contract";

const MAX_OCR_EDGE = 2200;
const MAX_DATA_URL_CHARS = 12_000_000;

export interface OCRRequest {
  imageDataUrl: string;
  sourceStyle: OCRSourceStyle;
  locale: "ru" | "en";
}

export type OCRResponse =
  | { ok: true; draft: OCRDraft; warnings?: string[] }
  | { ok: false; error: string; details?: string };

export async function recognizeImageWithOCR(
  blob: Blob,
  sourceStyle: OCRSourceStyle,
  locale: "ru" | "en",
): Promise<OCRDraft> {
  const imageDataUrl = await prepareImageDataUrl(blob);
  const response = await fetch("/api/ai/ocr-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageDataUrl, sourceStyle, locale } satisfies OCRRequest),
  });
  const payload = (await response.json().catch(() => null)) as OCRResponse | null;
  if (!response.ok || !payload?.ok) {
    const error = payload && !payload.ok ? payload.error : `OCR request failed (${response.status})`;
    const details = payload && !payload.ok ? payload.details : undefined;
    throw new Error(details ? `${error}: ${details}` : error);
  }
  return normalizeOCRDraft(payload.draft, { sourceStyle, locale });
}

export async function prepareImageDataUrl(blob: Blob): Promise<string> {
  const image = await loadImage(blob);
  const scale = Math.min(1, MAX_OCR_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available for image preparation.");
  context.drawImage(image, 0, 0, width, height);

  const preferPng = blob.type === "image/png" && blob.size < 4 * 1024 * 1024;
  const dataUrl = canvas.toDataURL(preferPng ? "image/png" : "image/jpeg", preferPng ? undefined : 0.88);
  if (dataUrl.length > MAX_DATA_URL_CHARS) {
    throw new Error("Prepared image is still too large for OCR. Crop it or use a smaller photo.");
  }
  return dataUrl;
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
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
