import type { IngestChunk } from "./document-ingestion";
import type { MaterialSourceLanguage } from "./store";

export const OCR_PROMPT_VERSION = "ocr-draft-v1";
export const OCR_AUTOMATIC_REVIEW_THRESHOLD = 0.85;
export const OCR_REGION_REVIEW_THRESHOLD = 0.78;

export type OCRSourceStyle = "printed" | "handwritten" | "whiteboard" | "mixed";
export type OCRRegionKind =
  "heading" | "paragraph" | "list" | "math" | "table" | "diagram" | "unknown";

export interface OCRBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OCRRegion {
  id: string;
  order: number;
  kind: OCRRegionKind;
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
      (region) => region.text || region.uncertainTokens.length > 0 || region.kind === "diagram",
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
    if (region.boundingBox && !isValidBoundingBox(region.boundingBox)) {
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
    text: asString(object.text).trim(),
    normalizedMath: asString(object.normalizedMath).trim() || undefined,
    pageNumber: positiveInteger(object.pageNumber),
    confidence,
    language: asLanguage(object.language),
    boundingBox: normalizeBoundingBox(object.boundingBox),
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

function normalizeBoundingBox(value: unknown): OCRBoundingBox | undefined {
  if (!isRecord(value)) return undefined;
  const box = {
    x: finiteNumber(value.x),
    y: finiteNumber(value.y),
    width: finiteNumber(value.width),
    height: finiteNumber(value.height),
  };
  if (Object.values(box).some((item) => item == null)) return undefined;
  return box as OCRBoundingBox;
}

function isValidBoundingBox(box: OCRBoundingBox): boolean {
  return (
    Number.isFinite(box.x) &&
    Number.isFinite(box.y) &&
    Number.isFinite(box.width) &&
    Number.isFinite(box.height) &&
    box.x >= 0 &&
    box.y >= 0 &&
    box.width > 0 &&
    box.height > 0
  );
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

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
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
