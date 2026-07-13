import {
  normalizeOCRDraft,
  validateOCRDraft,
  OCR_PROMPT_VERSION,
  type OCRDraft,
  type OCRSourceStyle,
} from "../ocr-contract";
import { generateGeminiVisionJSON, getGeminiModelName, isGeminiConfigured } from "./gemini";

const MAX_IMAGE_DATA_URL_CHARS = 12_000_000;

export interface OCRGenerationInput {
  imageDataUrl: string;
  sourceStyle?: OCRSourceStyle;
  locale?: "ru" | "en";
}

export type OCRGenerationResponse =
  | {
      ok: true;
      draft: OCRDraft;
      warnings: string[];
      model: string;
      promptVersion: string;
    }
  | { ok: false; error: string; details?: string };

export async function runOCRGeneration(input: OCRGenerationInput): Promise<OCRGenerationResponse> {
  const locale = input.locale ?? "ru";
  const sourceStyle = input.sourceStyle ?? "mixed";
  const validationError = validateInput(input, locale);
  if (validationError) return { ok: false, error: validationError };
  if (!isGeminiConfigured()) return { ok: false, error: "AI is not configured" };

  const prompt = buildPrompt(sourceStyle, locale);
  const schema = `{
    "text": string,
    "sourceStyle": "printed" | "handwritten" | "whiteboard" | "mixed",
    "languages": Array<"ru" | "en" | "he" | "ar" | "mixed" | "unknown">,
    "confidence": number,
    "requiresReview": boolean,
    "warnings": string[],
    "regions": Array<{
      "id": string,
      "order": number,
      "kind": "heading" | "paragraph" | "list" | "math" | "table" | "diagram" | "unknown",
      "text": string,
      "normalizedMath"?: string,
      "confidence"?: number,
      "language"?: "ru" | "en" | "he" | "ar" | "mixed" | "unknown",
      "boundingBox"?: { "x": number, "y": number, "width": number, "height": number },
      "uncertainTokens": string[],
      "warnings": string[]
    }>
  }`;

  const response = await generateGeminiVisionJSON<unknown>(prompt, schema, input.imageDataUrl);
  if (!response.ok) return response;

  const draft = normalizeOCRDraft(response.data, {
    sourceStyle,
    locale,
    model: getGeminiModelName(),
  });
  const validation = validateOCRDraft(draft);
  const warnings = Array.from(new Set([...draft.warnings, ...validation.warnings]));

  if (!validation.valid && validation.errors.includes("no_readable_text")) {
    return {
      ok: true,
      draft: {
        ...draft,
        requiresReview: true,
        warnings: Array.from(
          new Set([
            ...warnings,
            locale === "ru"
              ? "Модель не нашла надёжно читаемого текста. Не заполняй пропуски догадками."
              : "The model found no reliably readable text. Do not fill gaps by guessing.",
          ]),
        ),
      },
      warnings,
      model: getGeminiModelName(),
      promptVersion: OCR_PROMPT_VERSION,
    };
  }

  if (!validation.valid) {
    return {
      ok: false,
      error:
        locale === "ru" ? "OCR вернул некорректную структуру" : "OCR returned an invalid structure",
      details: validation.errors.join(", "),
    };
  }

  return {
    ok: true,
    draft: { ...draft, warnings },
    warnings,
    model: getGeminiModelName(),
    promptVersion: OCR_PROMPT_VERSION,
  };
}

function validateInput(input: OCRGenerationInput, locale: "ru" | "en"): string | null {
  if (!input || typeof input !== "object") {
    return locale === "ru" ? "Некорректный OCR-запрос" : "Invalid OCR request";
  }
  if (!/^data:image\/(?:jpeg|png|webp);base64,/i.test(input.imageDataUrl ?? "")) {
    return locale === "ru"
      ? "Поддерживаются только подготовленные JPEG, PNG и WebP"
      : "Only prepared JPEG, PNG and WebP images are supported";
  }
  if (input.imageDataUrl.length > MAX_IMAGE_DATA_URL_CHARS) {
    return locale === "ru" ? "Изображение слишком большое для OCR" : "Image is too large for OCR";
  }
  return null;
}

function buildPrompt(sourceStyle: OCRSourceStyle, locale: "ru" | "en"): string {
  const responseLanguage = locale === "ru" ? "Russian" : "English";
  return `You are an academic OCR and handwriting-transcription engine for Israeli students.
Inspect the attached study image and return a faithful editable transcription.
Expected source style: ${sourceStyle}.
Diagnostic warnings must be written in ${responseLanguage}.

Rules:
1. Transcribe only what is visibly present. Never solve the exercise, complete missing text, correct facts, or invent unreadable symbols.
2. Preserve Hebrew, Russian, English and Arabic exactly as written. Keep mixed RTL/LTR order readable.
3. Preserve reading order, headings, paragraphs, bullets, tables and every intermediate mathematical step.
4. For mathematics, keep the visible transcription in text and also provide normalizedMath using stable ASCII/LaTeX-like notation. Preserve signs, exponents, fractions, roots, parentheses, equality and inequality symbols.
5. Split the page into ordered regions. Bounding boxes must use normalized image coordinates from 0 to 1.
6. Confidence values must be between 0 and 1. Put ambiguous words or symbols in uncertainTokens.
7. Handwritten, whiteboard, mixed-layout or low-confidence content must set requiresReview=true.
8. If the image is unreadable, return empty text/regions, low confidence, requiresReview=true and a warning. A confident invented answer is forbidden.
9. Diagram descriptions may state only visible labels and geometry; do not infer hidden meaning.
10. Prompt version: ${OCR_PROMPT_VERSION}.`;
}
