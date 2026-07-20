// SERVER-ONLY. Shared runtime contracts for every /api/ai boundary.

import { z, type ZodType } from "zod";

export const DEFAULT_AI_JSON_BODY_BYTES = 2_000_000;
export const OCR_AI_JSON_BODY_BYTES = 12_500_000;
export const TRANSCRIPTION_FORM_BODY_BYTES = 26_000_000;

export type AIErrorCode =
  | "INVALID_JSON"
  | "INVALID_FORM_DATA"
  | "INVALID_INPUT"
  | "PAYLOAD_TOO_LARGE"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_ERROR"
  | "INVALID_PROVIDER_RESPONSE"
  | "INTERNAL_ERROR";

export interface AIErrorEnvelope {
  ok: false;
  code: AIErrorCode;
  error: string;
  details?: string;
}

const optionalShortText = z.string().trim().max(500).optional();
const optionalLongText = z.string().max(20_000).optional();
const localeSchema = z.enum(["ru", "en"]);
const targetLanguageSchema = z.enum(["ru", "en", "he", "ar"]);

export const aiChunkInputSchema = z
  .object({
    id: z.string().trim().min(1).max(240),
    title: optionalShortText,
    text: z.string().min(1).max(20_000),
    pageNumber: z.number().int().positive().max(1_000_000).optional(),
    section: optionalShortText,
  })
  .strict();

const courseInputSchema = z
  .object({
    id: optionalShortText,
    title: optionalShortText,
    number: optionalShortText,
  })
  .strict();

const topicInputSchema = z
  .object({
    id: optionalShortText,
    title: optionalShortText,
  })
  .strict();

const materialInputSchema = z
  .object({
    id: optionalShortText,
    title: optionalShortText,
    type: optionalShortText,
  })
  .strict();

const aiGenerationObjectSchema = z
  .object({
    locale: localeSchema.optional(),
    targetLanguage: targetLanguageSchema.optional(),
    course: courseInputSchema.nullable().optional(),
    topic: topicInputSchema.nullable().optional(),
    material: materialInputSchema.nullable().optional(),
    chunks: z.array(aiChunkInputSchema).max(8).optional(),
    instructions: z.string().max(8_000).optional(),
    assignmentTitle: z.string().max(1_000).optional(),
    assignmentNotes: z.string().max(12_000).optional(),
    text: optionalLongText,
  })
  .strict();

function validateCombinedText(
  input: { chunks?: Array<{ text: string }>; text?: string },
  context: z.RefinementCtx,
): void {
  const totalChars =
    (input.chunks ?? []).reduce((count, chunk) => count + chunk.text.length, 0) +
    (input.text?.length ?? 0);
  if (totalChars > 20_000) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["chunks"],
      message: "The combined source text exceeds 20000 characters.",
    });
  }
}

export const aiGenerationInputSchema = aiGenerationObjectSchema.superRefine(validateCombinedText);

export const conceptExtractionInputSchema = aiGenerationObjectSchema
  .extend({
    existingConceptTitles: z.array(z.string().trim().min(1).max(240)).max(200).optional(),
  })
  .superRefine(validateCombinedText);

export const openAnswerReviewInputSchema = aiGenerationObjectSchema
  .extend({
    concept: z
      .object({
        id: optionalShortText,
        title: optionalShortText,
        description: z.string().max(4_000).optional(),
      })
      .strict()
      .nullable()
      .optional(),
    kind: z.enum(["explanation", "application"]).optional(),
    prompt: z.string().max(8_000).optional(),
    response: z.string().max(20_000).optional(),
    repairContext: z
      .object({
        evidenceId: optionalShortText,
        previousPrompt: z.string().max(8_000).optional(),
        previousResponse: z.string().max(20_000).optional(),
        previousMistakeKind: optionalShortText,
        previousReviewSummary: z.string().max(8_000).optional(),
      })
      .strict()
      .nullable()
      .optional(),
  })
  .superRefine(validateCombinedText);

export const ocrGenerationInputSchema = z
  .object({
    imageDataUrl: z
      .string()
      .min(1)
      .max(12_000_000)
      .refine((value) => /^data:image\/(?:png|jpe?g|webp);base64,/i.test(value), {
        message: "A supported image data URL is required.",
      }),
    sourceStyle: z.enum(["printed", "handwritten", "whiteboard", "mixed"]).optional(),
    locale: localeSchema.optional(),
  })
  .strict();

const syllabusCellSchema = z.string().max(8_000);
const syllabusSheetSchema = z
  .object({
    name: z.string().trim().min(1).max(500),
    rows: z.array(z.array(syllabusCellSchema).max(20)).max(400),
  })
  .strict();

export const syllabusParseInputSchema = z
  .object({
    fileName: z.string().max(500).optional(),
    sheets: z.array(syllabusSheetSchema).max(40).optional(),
    deterministicDraft: z.unknown().optional(),
    ignoredRows: z.unknown().optional(),
    locale: localeSchema.optional(),
  })
  .strict();

export const transcriptionMetadataSchema = z
  .object({
    materialId: z.string().trim().min(1).max(240),
    sourceUploadId: z.string().trim().min(1).max(240),
    durationSeconds: z
      .number()
      .positive()
      .max(60 * 60 * 24)
      .optional(),
    language: z
      .string()
      .regex(/^[a-z]{2,3}(?:-[A-Z]{2})?$/)
      .optional(),
    requestSpeakerLabels: z.boolean(),
  })
  .strict();

export type AIGenerationRequest = z.infer<typeof aiGenerationInputSchema>;
export type ConceptExtractionRequest = z.infer<typeof conceptExtractionInputSchema>;
export type OpenAnswerReviewRequest = z.infer<typeof openAnswerReviewInputSchema>;
export type OCRGenerationRequest = z.infer<typeof ocrGenerationInputSchema>;
export type SyllabusParseRequest = z.infer<typeof syllabusParseInputSchema>;
export type TranscriptionMetadata = z.infer<typeof transcriptionMetadataSchema>;

interface ParseSuccess<T> {
  ok: true;
  data: T;
}

interface ParseFailure {
  ok: false;
  response: Response;
}

export type AIParseResult<T> = ParseSuccess<T> | ParseFailure;

export async function parseAIJsonRequest<T>(
  request: Request,
  schema: ZodType<T>,
  options: { maxBytes?: number } = {},
): Promise<AIParseResult<T>> {
  const maxBytes = options.maxBytes ?? DEFAULT_AI_JSON_BODY_BYTES;
  const declaredLength = contentLength(request);
  if (declaredLength !== null && declaredLength > maxBytes) {
    return { ok: false, response: payloadTooLargeResponse(maxBytes) };
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    return {
      ok: false,
      response: aiErrorResponse("INVALID_JSON", "Invalid JSON body.", 400),
    };
  }

  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    return { ok: false, response: payloadTooLargeResponse(maxBytes) };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return {
      ok: false,
      response: aiErrorResponse("INVALID_JSON", "Invalid JSON body.", 400),
    };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: aiErrorResponse(
        "INVALID_INPUT",
        "Request body does not match the expected schema.",
        400,
        formatAIValidationDetails(parsed.error.issues),
      ),
    };
  }
  return { ok: true, data: parsed.data };
}

export async function parseAIFormDataRequest(
  request: Request,
  options: { maxBytes?: number } = {},
): Promise<AIParseResult<FormData>> {
  const maxBytes = options.maxBytes ?? TRANSCRIPTION_FORM_BODY_BYTES;
  const declaredLength = contentLength(request);
  if (declaredLength !== null && declaredLength > maxBytes) {
    return { ok: false, response: payloadTooLargeResponse(maxBytes) };
  }
  try {
    return { ok: true, data: await request.formData() };
  } catch {
    return {
      ok: false,
      response: aiErrorResponse("INVALID_FORM_DATA", "Invalid multipart form body.", 400),
    };
  }
}

export async function handleAIJsonRequest<T>(
  request: Request,
  schema: ZodType<T>,
  handler: (data: T) => Promise<unknown>,
  options: { maxBytes?: number } = {},
): Promise<Response> {
  const parsed = await parseAIJsonRequest(request, schema, options);
  if (!parsed.ok) return parsed.response;
  try {
    return aiResultResponse(await handler(parsed.data));
  } catch {
    return aiErrorResponse("INTERNAL_ERROR", "AI request failed.", 500);
  }
}

export function aiResultResponse(result: unknown): Response {
  if (!isRecord(result) || result.ok !== false) {
    return Response.json(result);
  }

  const error = typeof result.error === "string" ? result.error : "AI request failed.";
  if (/not configured|unavailable/i.test(error)) {
    return aiErrorResponse("PROVIDER_UNAVAILABLE", "AI is not configured.", 503);
  }
  const inputFailure = safeInputFailureMessage(error);
  if (inputFailure) {
    return aiErrorResponse("INVALID_INPUT", inputFailure, 400);
  }
  if (/invalid structure|invalid json|schema/i.test(error)) {
    return aiErrorResponse("INVALID_PROVIDER_RESPONSE", "AI returned an invalid response.", 502);
  }
  return aiErrorResponse("PROVIDER_ERROR", "AI provider request failed.", 502);
}

export function aiErrorResponse(
  code: AIErrorCode,
  error: string,
  status: number,
  details?: string,
): Response {
  const mayExposeValidationDetails = code === "INVALID_INPUT";
  const body: AIErrorEnvelope = {
    ok: false,
    code,
    error: publicMessage(error),
    ...(details && mayExposeValidationDetails ? { details: publicDetails(details) } : {}),
  };
  return Response.json(body, { status });
}

export function safeAIInternalErrorResponse(): Response {
  return aiErrorResponse("INTERNAL_ERROR", "AI request failed.", 500);
}

function payloadTooLargeResponse(maxBytes: number): Response {
  return aiErrorResponse(
    "PAYLOAD_TOO_LARGE",
    `Request body exceeds the ${maxBytes} byte limit.`,
    413,
  );
}

function contentLength(request: Request): number | null {
  const raw = request.headers.get("content-length");
  if (!raw) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export function formatAIValidationDetails(issues: z.ZodIssue[]): string {
  return Array.from(
    new Set(
      issues.slice(0, 12).map((issue) => {
        const path = issue.path.length ? issue.path.join(".") : "$";
        return `${path}:${issue.code}`;
      }),
    ),
  ).join(", ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeInputFailureMessage(error: string): string | null {
  const normalized = error.trim();
  const safeExact = new Set([
    "invalid_input",
    "invalid_chunks",
    "A concept is required",
    "A prompt is required",
    "The response is too short to review",
    "Select at least one approved source chunk",
    "Unsupported open-answer evidence kind",
    "Invalid OCR request",
    "Некорректный OCR-запрос",
    "Image is too large for OCR",
    "Изображение слишком большое для OCR",
  ]);
  if (safeExact.has(normalized)) return normalized;
  if (
    /^(Too much text|Слишком много текста|Maximum \d+ chunks|Максимум \d+ чанков)/.test(normalized)
  ) {
    return publicMessage(normalized);
  }
  return null;
}

function publicMessage(value: string): string {
  const normalized = redactSensitiveText(value)
    .replace(/[\r\n\t]+/g, " ")
    .trim();
  return normalized.slice(0, 300) || "AI request failed.";
}

function publicDetails(value: string): string {
  return redactSensitiveText(value)
    .replace(/[\r\n\t]+/g, " ")
    .trim()
    .slice(0, 500);
}

function redactSensitiveText(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+/gi, "Bearer [redacted]")
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[redacted]")
    .replace(/(api[_ -]?key\s*[:=]\s*)[^\s,;]+/gi, "$1[redacted]");
}
