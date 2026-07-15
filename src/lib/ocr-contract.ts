import type { IngestChunk } from "./document-ingestion";
import type { MaterialSourceLanguage } from "./store";

export const OCR_PROMPT_VERSION = "ocr-draft-v1";
export const OCR_AUTOMATIC_REVIEW_THRESHOLD = 0.85;
export const OCR_REGION_REVIEW_THRESHOLD = 0.78;

export type OCRSourceStyle = "printed" | "handwritten" | "whiteboard" | "mixed";
export type OCRRegionKind =
  | "heading"
  | "paragraph"
  | "list"
  | "math"
  | "table"
  | "diagram"
  | "unknown";

export interface OCRBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Binds an OCR draft to the exact visual raster it was created from. Bounding
 * boxes are normalized against that raster, so a later crop/rotation cannot
 * silently show coordinates over an incompatible preview.
 */
export interface OCRVisualSourceContext {
  kind: "original" | "processed";
  /** Timestamp of the immutable original source record. */
  sourceUpdatedAt: number;
  /** Present only for a processed image and identifies its recipe/cache. */
  processedRecipeKey?: string;
}

export interface OCRRegion {
  id: string;
  order: number;
  kind: OCRRegionKind;
  /** Empty regions are retained only when the student deliberately created them. */
  manual?: boolean;
  text: string;
  normalizedMath?: string;
  pageNumber?: number;
  confidence?: number;
  language?: MaterialSourceLanguage;
  boundingBox?: OCRBoundingBox;
  uncertainTokens: string[];
  warnings: string[];
}

export interface OCRDraft {
  text: string;
  regions: OCRRegion[];
  sourceStyle: OCRSourceStyle;
  languages: MaterialSourceLanguage[];
  pageCount?: number;
  confidence?: number;
  requiresReview: boolean;
  warnings: string[];
  model?: string;
  promptVersion: string;
  visualSource?: OCRVisualSourceContext;
}

export interface OCRNormalizationContext {
  sourceStyle?: OCRSourceStyle;
  locale?: "ru" | "en";
  model?: string;
  pageCount?: number;
}

export interface OCRValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "heic", "heif"]);
const IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export function isOCRImageMime(mimeType: string | undefined): boolean {
  if (!mimeType) return false;
  return IMAGE_MIME_TYPES.has(mimeType.toLowerCase());
}

export function isOCRImageFileName(fileName: string): boolean {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_EXTENSIONS.has(extension);
}

export function normalizeOCRDraft(raw: unknown, context: OCRNormalizationContext = {}): OCRDraft {
  const object = isRecord(raw) ? raw : {};
  const locale = context.locale ?? "ru";
  const sourceStyle = asSourceStyle(object.sourceStyle) ?? context.sourceStyle ?? "mixed";
  const rawRegions = Array.isArray(object.regions) ? object.regions : [];
  const regions = rawRegions
    .slice(0, 500)
    .map((value, index) => normalizeRegion(value, index, locale))
    .filter(
      (region) =>
        region.text ||
        region.manual === true ||
        Boolean(region.boundingBox) ||
        region.uncertainTokens.length > 0 ||
        region.kind === "diagram",
    )
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));

  const warnings = uniqueStrings(object.warnings);
  const explicitText = asString(object.text).trim();
  const text =
    explicitText ||
    regions
      .map((region) => region.text)
      .filter(Boolean)
      .join("\n");
  const confidence = optionalConfidence(object.confidence);
  const languages = normalizeLanguages(object.languages, regions);
  const pageCount = positiveInteger(object.pageCount) ?? context.pageCount;
  const visualSource = normalizeVisualSourceContext(object.visualSource);

  const lowConfidenceRegionCount = regions.filter(
    (region) => region.confidence != null && region.confidence < OCR_REGION_REVIEW_THRESHOLD,
  ).length;
  const uncertainTokenCount = regions.reduce(
    (count, region) => count + region.uncertainTokens.length,
    0,
  );
  const requiresReview =
    object.requiresReview === true ||
    confidence == null ||
    confidence < OCR_AUTOMATIC_REVIEW_THRESHOLD ||
    lowConfidenceRegionCount > 0 ||
    uncertainTokenCount > 0 ||
    warnings.length > 0 ||
    sourceStyle === "handwritten" ||
    sourceStyle === "whiteboard";

  if (!text && regions.length === 0) {
    warnings.push(
      locale === "ru"
        ? "OCR не вернул читаемого текста. Нужна ручная проверка изображения."
        : "OCR returned no readable text. Manual image review is required.",
    );
  }
  if (lowConfidenceRegionCount > 0) {
    warnings.push(
      locale === "ru"
        ? `Низкая уверенность в регионах: ${lowConfidenceRegionCount}.`
        : `Low-confidence regions: ${lowConfidenceRegionCount}.`,
    );
  }
  if (uncertainTokenCount > 0) {
    warnings.push(
      locale === "ru"
        ? `Неуверенно распознано токенов: ${uncertainTokenCount}.`
        : `Uncertain recognized tokens: ${uncertainTokenCount}.`,
    );
  }

  return {
    text,
    regions,
    sourceStyle,
    languages,
    pageCount,
    confidence,
    requiresReview,
    warnings: Array.from(new Set(warnings)),
    model: asString(object.model).trim() || context.model,
    promptVersion: asString(object.promptVersion).trim() || OCR_PROMPT_VERSION,
    visualSource,
  };
}

export function validateOCRDraft(draft: OCRDraft): OCRValidationResult {
  const errors: string[] = [];
  const warnings = [...draft.warnings];

  if (!draft.text.trim() && draft.regions.every((region) => !region.text.trim())) {
    errors.push("no_readable_text");
  }
  if (draft.promptVersion !== OCR_PROMPT_VERSION) warnings.push("prompt_version_mismatch");
  if (draft.confidence != null && (draft.confidence < 0 || draft.confidence > 1)) {
    errors.push("invalid_confidence");
  }

  const ids = new Set<string>();
  for (const region of draft.regions) {
    if (ids.has(region.id)) errors.push(`duplicate_region_id:${region.id}`);
    ids.add(region.id);
    if (!Number.isInteger(region.order) || region.order < 0) {
      errors.push(`invalid_region_order:${region.id}`);
    }
    if (region.confidence != null && (region.confidence < 0 || region.confidence > 1)) {
      errors.push(`invalid_region_confidence:${region.id}`);
    }
    if (region.boundingBox && !isValidOCRBoundingBox(region.boundingBox)) {
      errors.push(`invalid_bounding_box:${region.id}`);
    }
    if (region.kind === "math" && !region.normalizedMath) {
      warnings.push(`math_region_without_normalized_math:${region.id}`);
    }
  }

  if (!draft.requiresReview && draft.sourceStyle !== "printed") {
    warnings.push("non_printed_source_without_review");
  }

  return {
    valid: errors.length === 0,
    errors: Array.from(new Set(errors)),
    warnings: Array.from(new Set(warnings)),
  };
}

export function ocrDraftToChunks(draft: OCRDraft): IngestChunk[] {
  if (draft.regions.length === 0) {
    return draft.text.trim()
      ? [
          {
            order: 0,
            title: "OCR text",
            text: draft.text.trim(),
            section: "ocr",
          },
        ]
      : [];
  }

  return draft.regions
    .filter((region) => region.text.trim())
    .map((region, index) => ({
      order: index,
      title: regionTitle(region, index),
      text:
        region.kind === "math" && region.normalizedMath
          ? `${region.text.trim()}\n\n[math] ${region.normalizedMath}`
          : region.text.trim(),
      pageNumber: region.pageNumber,
      section: `ocr:${region.kind}`,
    }));
}

function normalizeRegion(value: unknown, index: number, locale: "ru" | "en"): OCRRegion {
  const object = isRecord(value) ? value : {};
  const kind = asRegionKind(object.kind) ?? "unknown";
  const confidence = optionalConfidence(object.confidence);
  const uncertainTokens = uniqueStrings(object.uncertainTokens);
  const warnings = uniqueStrings(object.warnings);
  if (confidence != null && confidence < OCR_REGION_REVIEW_THRESHOLD) {
    warnings.push(locale === "ru" ? "Низкая уверенность региона." : "Low region confidence.");
  }

  return {
    id: asString(object.id).trim() || `ocr_region_${index + 1}`,
    order: nonNegativeInteger(object.order) ?? index,
    kind,
    manual: object.manual === true || undefined,
    text: asString(object.text).trim(),
    normalizedMath: asString(object.normalizedMath).trim() || undefined,
    pageNumber: positiveInteger(object.pageNumber),
    confidence,
    language: asLanguage(object.language),
    boundingBox: normalizeOCRBoundingBox(object.boundingBox),
    uncertainTokens,
    warnings: Array.from(new Set(warnings)),
  };
}

function normalizeLanguages(value: unknown, regions: OCRRegion[]): MaterialSourceLanguage[] {
  const explicit = Array.isArray(value)
    ? value.map(asLanguage).filter((item): item is MaterialSourceLanguage => Boolean(item))
    : [];
  const inferred = regions
    .map((region) => region.language)
    .filter((item): item is MaterialSourceLanguage => Boolean(item));
  const languages = Array.from(new Set([...explicit, ...inferred]));
  return languages.length > 0 ? languages : ["unknown"];
}

export function normalizeOCRBoundingBox(value: unknown): OCRBoundingBox | undefined {
  if (!isRecord(value)) return undefined;
  const rawX = finiteNumber(value.x);
  const rawY = finiteNumber(value.y);
  const rawWidth = finiteNumber(value.width);
  const rawHeight = finiteNumber(value.height);
  if (rawX == null || rawY == null || rawWidth == null || rawHeight == null) return undefined;
  const x = clamp(rawX, 0, 1);
  const y = clamp(rawY, 0, 1);
  const width = clamp(rawWidth, 0, 1 - x);
  const height = clamp(rawHeight, 0, 1 - y);
  if (width <= 0 || height <= 0) return undefined;
  return { x, y, width, height };
}

export function isValidOCRBoundingBox(box: OCRBoundingBox): boolean {
  return (
    Number.isFinite(box.x) &&
    Number.isFinite(box.y) &&
    Number.isFinite(box.width) &&
    Number.isFinite(box.height) &&
    box.x >= 0 &&
    box.y >= 0 &&
    box.width > 0 &&
    box.height > 0 &&
    box.x + box.width <= 1 &&
    box.y + box.height <= 1
  );
}

export function moveOCRBoundingBox(
  box: OCRBoundingBox,
  deltaX: number,
  deltaY: number,
): OCRBoundingBox {
  const width = clamp(box.width, 0.02, 1);
  const height = clamp(box.height, 0.02, 1);
  return {
    x: clamp(box.x + deltaX, 0, 1 - width),
    y: clamp(box.y + deltaY, 0, 1 - height),
    width,
    height,
  };
}

export function resizeOCRBoundingBox(
  box: OCRBoundingBox,
  width: number,
  height: number,
): OCRBoundingBox {
  const x = clamp(box.x, 0, 1);
  const y = clamp(box.y, 0, 1);
  return {
    x,
    y,
    width: clamp(width, 0.02, 1 - x),
    height: clamp(height, 0.02, 1 - y),
  };
}

function regionTitle(region: OCRRegion, index: number): string {
  const page = region.pageNumber ? `p.${region.pageNumber} · ` : "";
  const labels: Record<OCRRegionKind, string> = {
    heading: "Heading",
    paragraph: "Paragraph",
    list: "List",
    math: "Math",
    table: "Table",
    diagram: "Diagram",
    unknown: "Region",
  };
  return `${page}${labels[region.kind]} ${index + 1}`;
}

function asSourceStyle(value: unknown): OCRSourceStyle | undefined {
  return ["printed", "handwritten", "whiteboard", "mixed"].includes(String(value))
    ? (value as OCRSourceStyle)
    : undefined;
}

function asRegionKind(value: unknown): OCRRegionKind | undefined {
  return ["heading", "paragraph", "list", "math", "table", "diagram", "unknown"].includes(
    String(value),
  )
    ? (value as OCRRegionKind)
    : undefined;
}

function asLanguage(value: unknown): MaterialSourceLanguage | undefined {
  return ["ru", "en", "he", "ar", "mixed", "unknown"].includes(String(value))
    ? (value as MaterialSourceLanguage)
    : undefined;
}

function optionalConfidence(value: unknown): number | undefined {
  const parsed = finiteNumber(value);
  if (parsed == null) return undefined;
  return Math.max(0, Math.min(1, parsed));
}

function normalizeVisualSourceContext(value: unknown): OCRVisualSourceContext | undefined {
  if (!isRecord(value)) return undefined;
  const kind = value.kind === "original" || value.kind === "processed" ? value.kind : undefined;
  const sourceUpdatedAt = finiteNumber(value.sourceUpdatedAt);
  if (!kind || sourceUpdatedAt == null || sourceUpdatedAt <= 0) return undefined;
  const processedRecipeKey = asString(value.processedRecipeKey).trim() || undefined;
  return {
    kind,
    sourceUpdatedAt,
    processedRecipeKey: kind === "processed" ? processedRecipeKey : undefined,
  };
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function positiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
}

function nonNegativeInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function uniqueStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
