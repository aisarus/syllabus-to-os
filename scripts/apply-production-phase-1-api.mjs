import { readFile, writeFile } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");
const write = (path, content) =>
  writeFile(path, content.endsWith("\n") ? content : `${content}\n`, "utf8");

function replaceExact(content, before, after, label) {
  if (!content.includes(before)) throw new Error(`Patch anchor not found: ${label}`);
  return content.replace(before, after);
}

const commonRoutes = [
  ["generate-note", "note", 2],
  ["generate-flashcards", "flashcards", 3],
  ["generate-quiz", "quiz", 4],
  ["generate-presentation-outline", "presentation", 4],
  ["simplify-text", "simplify", 1],
  ["translate-text", "translate", 1],
  ["generate-assignment-breakdown", "assignment", 2],
  ["generate-topic-explanation", "topic", 2],
];

await write(
  "src/lib/server/ai-route-schemas.ts",
  `import { z } from "zod";
import type { AIGenerationInput } from "./ai-generation.ts";

const shortText = z.string().trim().max(500);
const longText = z.string().max(20_000);
const chunkSchema = z
  .object({
    id: z.string().trim().min(1).max(200),
    title: z.string().max(500).optional(),
    text: z.string().max(20_000),
    pageNumber: z.number().int().positive().max(100_000).optional(),
    section: z.string().max(500).optional(),
  })
  .strict();

export const aiGenerationInputSchema: z.ZodType<AIGenerationInput> = z
  .object({
    locale: z.enum(["ru", "en"]).optional(),
    targetLanguage: z.enum(["ru", "en", "he", "ar"]).optional(),
    course: z
      .object({ id: shortText.optional(), title: shortText.optional(), number: shortText.optional() })
      .strict()
      .nullable()
      .optional(),
    topic: z.object({ id: shortText.optional(), title: shortText.optional() }).strict().nullable().optional(),
    material: z
      .object({ id: shortText.optional(), title: shortText.optional(), type: shortText.optional() })
      .strict()
      .nullable()
      .optional(),
    chunks: z.array(chunkSchema).max(8).optional(),
    instructions: z.string().max(4_000).optional(),
    assignmentTitle: z.string().max(500).optional(),
    assignmentNotes: z.string().max(8_000).optional(),
    text: longText.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const total =
      (value.text?.length ?? 0) +
      (value.chunks ?? []).reduce((sum, chunk) => sum + chunk.text.length, 0);
    if (total > 20_000) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Combined source text is too large." });
    }
  });

export const conceptExtractionInputSchema = aiGenerationInputSchema.and(
  z.object({ existingConceptTitles: z.array(z.string().max(500)).max(200).optional() }).strict(),
);

export const openAnswerReviewInputSchema = aiGenerationInputSchema.and(
  z
    .object({
      concept: z
        .object({ id: shortText.optional(), title: shortText.optional(), description: z.string().max(4_000).optional() })
        .strict()
        .nullable()
        .optional(),
      kind: z.enum(["explanation", "application"]).optional(),
      prompt: z.string().max(4_000).optional(),
      response: z.string().max(12_000).optional(),
      repairContext: z
        .object({
          evidenceId: shortText.optional(),
          previousPrompt: z.string().max(4_000).optional(),
          previousResponse: z.string().max(12_000).optional(),
          previousMistakeKind: shortText.optional(),
          previousReviewSummary: z.string().max(4_000).optional(),
        })
        .strict()
        .nullable()
        .optional(),
    })
    .strict(),
);

export const ocrGenerationInputSchema = z
  .object({
    imageDataUrl: z
      .string()
      .max(12_000_000)
      .regex(/^data:image\\/(?:jpeg|png|webp);base64,/i, "Unsupported image payload."),
    sourceStyle: z.enum(["printed", "handwritten", "whiteboard", "mixed"]).optional(),
    locale: z.enum(["ru", "en"]).optional(),
  })
  .strict();

export const syllabusParseInputSchema = z
  .object({
    fileName: z.string().max(500).optional(),
    sheets: z
      .array(
        z
          .object({
            name: z.string().max(500),
            rows: z.array(z.array(z.string().max(4_000)).max(20)).max(400),
          })
          .strict(),
      )
      .max(40)
      .optional(),
    deterministicDraft: z.unknown().optional(),
    ignoredRows: z.unknown().optional(),
    locale: z.enum(["ru", "en"]).optional(),
  })
  .strict();
`,
);

await write(
  "src/lib/server/ai-route-policy.ts",
  `import { createHash, randomUUID } from "node:crypto";
import type { z } from "zod";

export interface AIRequestContext {
  requestId: string;
  signal: AbortSignal;
  idempotencyKey?: string;
}

export interface AIJSONRouteOptions<TInput> {
  operation: string;
  schema: z.ZodType<TInput>;
  handler: (input: TInput, context: AIRequestContext) => Promise<unknown>;
  maxBodyBytes?: number;
  timeoutMs?: number;
  costUnits?: number;
  statusForResult?: (result: unknown) => number;
}

interface StoredResult {
  payload: unknown;
  status: number;
}

interface WindowCounter {
  startedAt: number;
  value: number;
}

interface IdempotentEntry {
  bodyHash: string;
  expiresAt: number;
  result: Promise<StoredResult>;
}

const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 12;
const BUDGET_WINDOW_MS = 5 * 60_000;
const BUDGET_LIMIT = 40;
const IDEMPOTENCY_TTL_MS = 10 * 60_000;
const DEFAULT_BODY_BYTES = 256 * 1024;
const DEFAULT_TIMEOUT_MS = 50_000;
const MAX_GLOBAL_CONCURRENCY = 4;
const MAX_OPERATION_CONCURRENCY = 2;

const rates = new Map<string, WindowCounter>();
const budgets = new Map<string, WindowCounter>();
const idempotent = new Map<string, IdempotentEntry>();
const activeByOperation = new Map<string, number>();
let activeGlobal = 0;

export async function handleAIJSONRequest<TInput>(
  request: Request,
  options: AIJSONRouteOptions<TInput>,
): Promise<Response> {
  const requestId = normalizeRequestId(request.headers.get("x-request-id"));
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_BODY_BYTES;
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > maxBodyBytes) {
    return errorResponse(requestId, 413, "PAYLOAD_TOO_LARGE", "Request body is too large.");
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return errorResponse(requestId, 400, "INVALID_BODY", "Request body could not be read.");
  }
  if (new TextEncoder().encode(raw).byteLength > maxBodyBytes) {
    return errorResponse(requestId, 413, "PAYLOAD_TOO_LARGE", "Request body is too large.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return errorResponse(requestId, 400, "INVALID_JSON", "Invalid JSON body.");
  }

  const validation = options.schema.safeParse(parsed);
  if (!validation.success) {
    return errorResponse(requestId, 422, "INVALID_INPUT", "Request validation failed.", {
      issues: validation.error.issues.slice(0, 12).map((issue) => ({
        code: issue.code,
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  return executeAIRequest(request, {
    operation: options.operation,
    requestId,
    bodyHash: hash(raw),
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    costUnits: options.costUnits ?? 1,
    statusForResult: options.statusForResult,
    work: (context) => options.handler(validation.data, context),
  });
}

export async function executeAIRequest(
  request: Request,
  options: {
    operation: string;
    requestId?: string;
    bodyHash: string;
    timeoutMs?: number;
    costUnits?: number;
    statusForResult?: (result: unknown) => number;
    work: (context: AIRequestContext) => Promise<unknown>;
  },
): Promise<Response> {
  const now = Date.now();
  prune(now);
  const requestId = options.requestId ?? normalizeRequestId(request.headers.get("x-request-id"));
  const clientKey = requestClientKey(request);
  const idempotencyKey = normalizeIdempotencyKey(request.headers.get("idempotency-key"));
  if (request.headers.has("idempotency-key") && !idempotencyKey) {
    return errorResponse(
      requestId,
      400,
      "INVALID_IDEMPOTENCY_KEY",
      "Idempotency-Key must contain 8–128 safe characters.",
    );
  }

  const replayKey = idempotencyKey
    ? \`\${clientKey}:\${options.operation}:\${idempotencyKey}\`
    : undefined;
  if (replayKey) {
    const existing = idempotent.get(replayKey);
    if (existing) {
      if (existing.bodyHash !== options.bodyHash) {
        return errorResponse(
          requestId,
          409,
          "IDEMPOTENCY_CONFLICT",
          "The same idempotency key was reused with a different request body.",
        );
      }
      return responseFromStored(await existing.result, requestId, true);
    }
  }

  if (!consumeWindow(rates, clientKey, RATE_LIMIT, RATE_WINDOW_MS, 1, now)) {
    return errorResponse(requestId, 429, "RATE_LIMITED", "Too many AI requests. Try again later.", undefined, {
      "retry-after": "60",
    });
  }
  if (
    !consumeWindow(
      budgets,
      clientKey,
      BUDGET_LIMIT,
      BUDGET_WINDOW_MS,
      Math.max(1, options.costUnits ?? 1),
      now,
    )
  ) {
    return errorResponse(
      requestId,
      429,
      "AI_BUDGET_EXCEEDED",
      "The temporary AI request budget has been exhausted.",
      undefined,
      { "retry-after": "300" },
    );
  }

  const operationActive = activeByOperation.get(options.operation) ?? 0;
  if (activeGlobal >= MAX_GLOBAL_CONCURRENCY || operationActive >= MAX_OPERATION_CONCURRENCY) {
    return errorResponse(
      requestId,
      429,
      "AI_CONCURRENCY_LIMIT",
      "Too many AI operations are already running.",
      undefined,
      { "retry-after": "5" },
    );
  }

  const execution = runBounded(request, {
    ...options,
    requestId,
    idempotencyKey,
  });
  if (replayKey) {
    idempotent.set(replayKey, {
      bodyHash: options.bodyHash,
      expiresAt: now + IDEMPOTENCY_TTL_MS,
      result: execution,
    });
  }
  return responseFromStored(await execution, requestId, false);
}

async function runBounded(
  request: Request,
  options: {
    operation: string;
    requestId: string;
    idempotencyKey?: string;
    timeoutMs?: number;
    statusForResult?: (result: unknown) => number;
    work: (context: AIRequestContext) => Promise<unknown>;
  },
): Promise<StoredResult> {
  activeGlobal += 1;
  activeByOperation.set(options.operation, (activeByOperation.get(options.operation) ?? 0) + 1);
  const controller = new AbortController();
  const relayAbort = () => controller.abort(request.signal.reason);
  request.signal.addEventListener("abort", relayAbort, { once: true });
  const timeoutMs = Math.max(1, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  try {
    const timeout = new Promise<StoredResult>((resolve) => {
      timeoutHandle = setTimeout(() => {
        controller.abort(new Error("AI request timeout"));
        resolve({
          status: 504,
          payload: errorPayload("AI_TIMEOUT", "The AI operation timed out.", true),
        });
      }, timeoutMs);
    });
    const work = Promise.resolve()
      .then(() =>
        options.work({
          requestId: options.requestId,
          signal: controller.signal,
          idempotencyKey: options.idempotencyKey,
        }),
      )
      .then((result): StoredResult => ({
        payload: normalizeResult(result),
        status: options.statusForResult?.(result) ?? statusForAIResult(result),
      }))
      .catch((error): StoredResult => {
        if (controller.signal.aborted) {
          return {
            status: request.signal.aborted ? 499 : 504,
            payload: errorPayload(
              request.signal.aborted ? "REQUEST_CANCELLED" : "AI_TIMEOUT",
              request.signal.aborted ? "The request was cancelled." : "The AI operation timed out.",
              !request.signal.aborted,
            ),
          };
        }
        return {
          status: 500,
          payload: errorPayload(
            "AI_INTERNAL_ERROR",
            error instanceof Error ? error.message : "The AI operation failed.",
            false,
          ),
        };
      });
    return await Promise.race([work, timeout]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
    request.signal.removeEventListener("abort", relayAbort);
    activeGlobal = Math.max(0, activeGlobal - 1);
    const next = Math.max(0, (activeByOperation.get(options.operation) ?? 1) - 1);
    if (next === 0) activeByOperation.delete(options.operation);
    else activeByOperation.set(options.operation, next);
  }
}

export function statusForAIResult(result: unknown): number {
  if (!result || typeof result !== "object" || !("ok" in result)) return 200;
  const record = result as { ok?: unknown; error?: unknown };
  if (record.ok !== false) return 200;
  const error = typeof record.error === "string" ? record.error : "";
  if (/not configured/i.test(error)) return 503;
  if (/rate limit/i.test(error)) return 429;
  if (/credits|budget/i.test(error)) return 402;
  if (/invalid|select|maximum|too much|required|unsupported/i.test(error)) return 400;
  return 502;
}

export function aiRequestFingerprint(parts: Array<string | number | undefined>): string {
  return hash(parts.map((part) => String(part ?? "")).join("\u001f"));
}

export function resetAIRequestPolicyForTests(): void {
  rates.clear();
  budgets.clear();
  idempotent.clear();
  activeByOperation.clear();
  activeGlobal = 0;
}

function normalizeResult(result: unknown): unknown {
  if (!result || typeof result !== "object") return { ok: true, data: result };
  return result;
}

function responseFromStored(stored: StoredResult, requestId: string, replayed: boolean): Response {
  const payload =
    stored.payload && typeof stored.payload === "object"
      ? { ...(stored.payload as Record<string, unknown>), requestId }
      : { ok: stored.status < 400, data: stored.payload, requestId };
  return Response.json(payload, {
    status: stored.status,
    headers: {
      "x-request-id": requestId,
      ...(replayed ? { "x-idempotency-replayed": "true" } : {}),
    },
  });
}

function errorResponse(
  requestId: string,
  status: number,
  code: string,
  message: string,
  details?: unknown,
  headers: Record<string, string> = {},
): Response {
  return Response.json(
    { ...errorPayload(code, message, status >= 500 || status === 429, details), requestId },
    { status, headers: { "x-request-id": requestId, ...headers } },
  );
}

function errorPayload(code: string, message: string, retryable: boolean, details?: unknown) {
  return { ok: false, error: message, code, retryable, ...(details === undefined ? {} : { details }) };
}

function consumeWindow(
  map: Map<string, WindowCounter>,
  key: string,
  limit: number,
  windowMs: number,
  amount: number,
  now: number,
): boolean {
  const current = map.get(key);
  const next = !current || now - current.startedAt >= windowMs ? { startedAt: now, value: 0 } : current;
  if (next.value + amount > limit) return false;
  next.value += amount;
  map.set(key, next);
  return true;
}

function prune(now: number): void {
  for (const [key, value] of idempotent) if (value.expiresAt <= now) idempotent.delete(key);
}

function normalizeRequestId(value: string | null): string {
  const trimmed = value?.trim();
  return trimmed && /^[A-Za-z0-9._:-]{8,128}$/.test(trimmed) ? trimmed : randomUUID();
}

function normalizeIdempotencyKey(value: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed && /^[A-Za-z0-9._:-]{8,128}$/.test(trimmed) ? trimmed : undefined;
}

function requestClientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const candidate = forwarded || request.headers.get("x-real-ip")?.trim() || "anonymous";
  return candidate.slice(0, 128);
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
`,
);

for (const [routeName, kind, costUnits] of commonRoutes) {
  await write(
    `src/routes/api/ai/${routeName}.ts`,
    `import { createFileRoute } from "@tanstack/react-router";
import { runAIGeneration } from "@/lib/server/ai-generation";
import { handleAIJSONRequest } from "@/lib/server/ai-route-policy";
import { aiGenerationInputSchema } from "@/lib/server/ai-route-schemas";

export const Route = createFileRoute("/api/ai/${routeName}")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        handleAIJSONRequest(request, {
          operation: "${routeName}",
          schema: aiGenerationInputSchema,
          costUnits: ${costUnits},
          handler: (body, context) => runAIGeneration("${kind}", body, context),
        }),
    },
  },
});
`,
  );
}

await write(
  "src/routes/api/ai/generate-study-pack.ts",
  `import { createFileRoute } from "@tanstack/react-router";
import { handleAIJSONRequest } from "@/lib/server/ai-route-policy";
import { aiGenerationInputSchema } from "@/lib/server/ai-route-schemas";
import { runStudyPackGeneration } from "@/lib/server/study-pack-generation";

export const Route = createFileRoute("/api/ai/generate-study-pack")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        handleAIJSONRequest(request, {
          operation: "generate-study-pack",
          schema: aiGenerationInputSchema,
          costUnits: 5,
          handler: (body) => runStudyPackGeneration(body),
        }),
    },
  },
});
`,
);

await write(
  "src/routes/api/ai/ocr-image.ts",
  `import { createFileRoute } from "@tanstack/react-router";
import { handleAIJSONRequest } from "@/lib/server/ai-route-policy";
import { ocrGenerationInputSchema } from "@/lib/server/ai-route-schemas";
import { runOCRGeneration } from "@/lib/server/ocr-generation";

export const Route = createFileRoute("/api/ai/ocr-image")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        handleAIJSONRequest(request, {
          operation: "ocr-image",
          schema: ocrGenerationInputSchema,
          maxBodyBytes: 13_000_000,
          costUnits: 6,
          handler: (body, context) => runOCRGeneration(body, context),
        }),
    },
  },
});
`,
);

await write(
  "src/routes/api/ai/extract-concepts.ts",
  `import { createFileRoute } from "@tanstack/react-router";
import { handleAIJSONRequest } from "@/lib/server/ai-route-policy";
import { conceptExtractionInputSchema } from "@/lib/server/ai-route-schemas";
import { runConceptExtractionGeneration } from "@/lib/server/concept-extraction-generation";

export const Route = createFileRoute("/api/ai/extract-concepts")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        handleAIJSONRequest(request, {
          operation: "extract-concepts",
          schema: conceptExtractionInputSchema,
          costUnits: 4,
          handler: (body) => runConceptExtractionGeneration(body),
        }),
    },
  },
});
`,
);

await write(
  "src/routes/api/ai/review-open-answer.ts",
  `import { createFileRoute } from "@tanstack/react-router";
import { handleAIJSONRequest } from "@/lib/server/ai-route-policy";
import { openAnswerReviewInputSchema } from "@/lib/server/ai-route-schemas";
import { runOpenAnswerReviewGeneration } from "@/lib/server/open-answer-review-generation";

export const Route = createFileRoute("/api/ai/review-open-answer")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        handleAIJSONRequest(request, {
          operation: "review-open-answer",
          schema: openAnswerReviewInputSchema,
          costUnits: 3,
          handler: (body) => runOpenAnswerReviewGeneration(body),
        }),
    },
  },
});
`,
);

let aiGeneration = await read("src/lib/server/ai-generation.ts");
aiGeneration = replaceExact(
  aiGeneration,
  `export async function runAIGeneration(\n  kind: AIKind,\n  input: AIGenerationInput,\n): Promise<AIRouteResponse<unknown>> {`,
  `export async function runAIGeneration(\n  kind: AIKind,\n  input: AIGenerationInput,\n  options: { signal?: AbortSignal } = {},\n): Promise<AIRouteResponse<unknown>> {`,
  "AI generation options",
);
aiGeneration = replaceExact(
  aiGeneration,
  `const response = await generateGeminiJSON<unknown>(prompt, schema);`,
  `const response = await generateGeminiJSON<unknown>(prompt, schema, options);`,
  "AI generation signal",
);
await write("src/lib/server/ai-generation.ts", aiGeneration);

let ocrGeneration = await read("src/lib/server/ocr-generation.ts");
ocrGeneration = replaceExact(
  ocrGeneration,
  `export async function runOCRGeneration(input: OCRGenerationInput): Promise<OCRGenerationResponse> {`,
  `export async function runOCRGeneration(\n  input: OCRGenerationInput,\n  options: { signal?: AbortSignal } = {},\n): Promise<OCRGenerationResponse> {`,
  "OCR generation options",
);
ocrGeneration = replaceExact(
  ocrGeneration,
  `const response = await generateGeminiVisionJSON<unknown>(prompt, schema, input.imageDataUrl);`,
  `const response = await generateGeminiVisionJSON<unknown>(\n    prompt,\n    schema,\n    input.imageDataUrl,\n    options,\n  );`,
  "OCR generation signal",
);
await write("src/lib/server/ocr-generation.ts", ocrGeneration);

await write(
  "src/lib/server/gemini.ts",
  `// SERVER-ONLY. Do not import from client code.

export const DEFAULT_GEMINI_MODEL = "google/gemini-3-flash-preview";
const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const PROVIDER_TIMEOUT_MS = 45_000;
const MAX_PROVIDER_ATTEMPTS = 2;

export interface GeminiRequestOptions {
  signal?: AbortSignal;
  maxAttempts?: number;
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.LOVABLE_API_KEY && process.env.LOVABLE_API_KEY.trim());
}

export function getGeminiModelName(): string {
  const model = process.env.LOVABLE_AI_MODEL?.trim();
  return model && model.length > 0 ? model : DEFAULT_GEMINI_MODEL;
}

export type GeminiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; details?: string };

interface TextContentPart {
  type: "text";
  text: string;
}

interface ImageContentPart {
  type: "image_url";
  image_url: { url: string };
}

type UserContent = string | Array<TextContentPart | ImageContentPart>;

export async function generateGeminiJSON<T = unknown>(
  prompt: string,
  schemaDescription: string,
  options: GeminiRequestOptions = {},
): Promise<GeminiResult<T>> {
  return requestJSON<T>(
    \`\${prompt}\\n\\nReturn ONLY a strict JSON object. No markdown, no commentary.\\n\\nExpected schema (informal):\\n\${schemaDescription}\`,
    options,
  );
}

export async function generateGeminiVisionJSON<T = unknown>(
  prompt: string,
  schemaDescription: string,
  imageDataUrl: string,
  options: GeminiRequestOptions = {},
): Promise<GeminiResult<T>> {
  if (!/^data:image\\/(?:jpeg|png|webp);base64,/i.test(imageDataUrl)) {
    return { ok: false, error: "Unsupported image payload" };
  }
  return requestJSON<T>(
    [
      {
        type: "text",
        text: \`\${prompt}\\n\\nReturn ONLY a strict JSON object. No markdown, no commentary.\\n\\nExpected schema (informal):\\n\${schemaDescription}\`,
      },
      { type: "image_url", image_url: { url: imageDataUrl } },
    ],
    options,
  );
}

async function requestJSON<T>(
  content: UserContent,
  options: GeminiRequestOptions,
): Promise<GeminiResult<T>> {
  const key = process.env.LOVABLE_API_KEY?.trim();
  if (!key) return { ok: false, error: "Lovable AI is not configured" };
  const attempts = Math.max(1, Math.min(MAX_PROVIDER_ATTEMPTS, options.maxAttempts ?? MAX_PROVIDER_ATTEMPTS));

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const relayAbort = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener("abort", relayAbort, { once: true });
    const timeout = setTimeout(
      () => controller.abort(new Error("Provider request timeout")),
      PROVIDER_TIMEOUT_MS,
    );

    try {
      const response = await fetch(LOVABLE_AI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": key,
          "X-Lovable-AIG-SDK": "custom-fetch",
        },
        body: JSON.stringify({
          model: getGeminiModelName(),
          temperature: 0.1,
          response_format: { type: "json_object" },
          messages: [{ role: "user", content }],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const retryable = [429, 502, 503, 504].includes(response.status);
        if (retryable && attempt < attempts && !options.signal?.aborted) {
          await delay(250 * attempt, options.signal);
          continue;
        }
        if (response.status === 429) {
          return { ok: false, error: "AI rate limit exceeded, try again later" };
        }
        if (response.status === 402) {
          return { ok: false, error: "AI credits exhausted for this workspace" };
        }
        return {
          ok: false,
          error: \`AI call failed (\${response.status})\`,
          details: \`provider_status=\${response.status}\`,
        };
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = (data.choices?.[0]?.message?.content ?? "").trim();
      if (!text) return { ok: false, error: "Empty AI response" };
      const parsed = safeParseJSON(text);
      if (!parsed.ok) return { ok: false, error: "AI returned invalid JSON" };
      return { ok: true, data: parsed.value as T };
    } catch (error) {
      if (options.signal?.aborted) return { ok: false, error: "AI request cancelled" };
      if (controller.signal.aborted) return { ok: false, error: "AI request timed out" };
      if (attempt < attempts) {
        await delay(250 * attempt, options.signal);
        continue;
      }
      return {
        ok: false,
        error: "AI call failed",
        details: error instanceof Error ? error.name : "provider_network_error",
      };
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", relayAbort);
    }
  }
  return { ok: false, error: "AI call failed" };
}

async function delay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return;
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, milliseconds);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
  });
}

function safeParseJSON(text: string): { ok: true; value: unknown } | { ok: false } {
  const trimmed = text.trim();
  const attempts = [trimmed];
  const fence = trimmed.match(/\`\`\`(?:json)?\\s*([\\s\\S]*?)\`\`\`/i);
  if (fence) attempts.push(fence[1].trim());
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) attempts.push(trimmed.slice(first, last + 1));
  for (const attempt of attempts) {
    try {
      return { ok: true, value: JSON.parse(attempt) };
    } catch {
      // Try the next representation.
    }
  }
  return { ok: false };
}
`,
);

let syllabus = await read("src/routes/api/ai/parse-syllabus.ts");
syllabus = replaceExact(
  syllabus,
  `import { generateGeminiJSON, getGeminiModelName, isGeminiConfigured } from "@/lib/server/gemini";`,
  `import { generateGeminiJSON, getGeminiModelName, isGeminiConfigured } from "@/lib/server/gemini";\nimport { handleAIJSONRequest } from "@/lib/server/ai-route-policy";\nimport { syllabusParseInputSchema } from "@/lib/server/ai-route-schemas";`,
  "syllabus imports",
);
const oldHandlerStart = `      POST: async ({ request }) => {\n        if (!isGeminiConfigured()) {`;
if (!syllabus.includes(oldHandlerStart))
  throw new Error("Patch anchor not found: syllabus handler");
const handlerStart = syllabus.indexOf(oldHandlerStart);
const handlerEndMarker = `        return Response.json({ ok: true, draft, warnings, model: getGeminiModelName() });\n      },`;
const handlerEnd = syllabus.indexOf(handlerEndMarker, handlerStart);
if (handlerEnd < 0) throw new Error("Patch anchor not found: syllabus handler end");
const handlerReplacement = `      POST: async ({ request }) =>\n        handleAIJSONRequest(request, {\n          operation: "parse-syllabus",\n          schema: syllabusParseInputSchema,\n          maxBodyBytes: 2_000_000,\n          costUnits: 5,\n          handler: async (body, context) => {\n            if (!isGeminiConfigured()) return { ok: false, error: "Lovable AI is not configured" };\n\n            const sheets = (body.sheets ?? []).map((sheet) => ({\n              name: sheet.name,\n              rows: sheet.rows.slice(0, 400).map((row) => row.slice(0, 20)),\n            }));\n            const prompt =\n              SYSTEM_INSTRUCTION +\n              "\\n\\nRefine the deterministic syllabus draft below. Input follows as JSON:\\n\\n" +\n              JSON.stringify({\n                fileName: body.fileName ?? "",\n                locale: body.locale ?? "ru",\n                deterministicDraft: body.deterministicDraft ?? null,\n                ignoredRows: body.ignoredRows ?? [],\n                sheets,\n              });\n            const response = await generateGeminiJSON<unknown>(prompt, SCHEMA_DESC, {\n              signal: context.signal,\n            });\n            if (!response.ok) {\n              return {\n                ok: false,\n                error: response.error,\n                details: response.details,\n                model: getGeminiModelName(),\n              };\n            }\n            const warnings: string[] = [];\n            const draft = validateAndClean(response.data, body.fileName ?? "", warnings);\n            if (!draft) {\n              return {\n                ok: false,\n                error: "Gemini returned invalid JSON",\n                details: "Failed schema validation",\n              };\n            }\n            return { ok: true, draft, warnings, model: getGeminiModelName() };\n          },\n        }),`;
syllabus =
  syllabus.slice(0, handlerStart) +
  handlerReplacement +
  syllabus.slice(handlerEnd + handlerEndMarker.length);
await write("src/routes/api/ai/parse-syllabus.ts", syllabus);

await write(
  "scripts/run-ai-route-policy-evals.mjs",
  `import assert from "node:assert/strict";
import { z } from "zod";
import {
  handleAIJSONRequest,
  resetAIRequestPolicyForTests,
} from "../src/lib/server/ai-route-policy.ts";

const schema = z.object({ text: z.string().max(32) }).strict();
const request = (body, headers = {}) =>
  new Request("https://lamdan.test/api/ai/test", {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": "127.0.0.1", ...headers },
    body,
  });

resetAIRequestPolicyForTests();
let response = await handleAIJSONRequest(request("{"), {
  operation: "test-invalid-json",
  schema,
  handler: async () => ({ ok: true }),
});
assert.equal(response.status, 400);
assert.equal((await response.json()).code, "INVALID_JSON");

response = await handleAIJSONRequest(request(JSON.stringify({ text: "x".repeat(40) })), {
  operation: "test-schema",
  schema,
  handler: async () => ({ ok: true }),
});
assert.equal(response.status, 422);
assert.equal((await response.json()).code, "INVALID_INPUT");

response = await handleAIJSONRequest(request(JSON.stringify({ text: "123456" })), {
  operation: "test-size",
  schema,
  maxBodyBytes: 4,
  handler: async () => ({ ok: true }),
});
assert.equal(response.status, 413);

resetAIRequestPolicyForTests();
let charges = 0;
const idempotentOptions = {
  operation: "test-idempotency",
  schema,
  costUnits: 2,
  handler: async () => {
    charges += 1;
    return { ok: true, draft: { value: charges } };
  },
};
const headers = { "idempotency-key": "same-request-0001" };
const first = await handleAIJSONRequest(request(JSON.stringify({ text: "same" }), headers), idempotentOptions);
const second = await handleAIJSONRequest(request(JSON.stringify({ text: "same" }), headers), idempotentOptions);
assert.equal(first.status, 200);
assert.equal(second.status, 200);
assert.equal(charges, 1);
assert.equal(second.headers.get("x-idempotency-replayed"), "true");

const conflict = await handleAIJSONRequest(
  request(JSON.stringify({ text: "different" }), headers),
  idempotentOptions,
);
assert.equal(conflict.status, 409);
assert.equal((await conflict.json()).code, "IDEMPOTENCY_CONFLICT");

resetAIRequestPolicyForTests();
response = await handleAIJSONRequest(request(JSON.stringify({ text: "slow" })), {
  operation: "test-timeout",
  schema,
  timeoutMs: 5,
  handler: async (_input, context) =>
    new Promise((resolve) => {
      context.signal.addEventListener("abort", () => resolve({ ok: false, error: "aborted" }), {
        once: true,
      });
    }),
});
assert.equal(response.status, 504);
assert.equal((await response.json()).code, "AI_TIMEOUT");

resetAIRequestPolicyForTests();
for (let index = 0; index < 2; index += 1) {
  response = await handleAIJSONRequest(request(JSON.stringify({ text: String(index) })), {
    operation: "test-budget",
    schema,
    costUnits: 20,
    handler: async () => ({ ok: true }),
  });
  assert.equal(response.status, 200);
}
response = await handleAIJSONRequest(request(JSON.stringify({ text: "third" })), {
  operation: "test-budget",
  schema,
  costUnits: 20,
  handler: async () => ({ ok: true }),
});
assert.equal(response.status, 429);
assert.equal((await response.json()).code, "AI_BUDGET_EXCEEDED");

console.log("AI route validation, timeout, idempotency, rate and cost policy evaluations passed.");
`,
);

await write(
  "scripts/verify-ai-route-policy-contract.mjs",
  `import { readFile } from "node:fs/promises";

const routeFiles = [
  "generate-note",
  "generate-flashcards",
  "generate-quiz",
  "generate-presentation-outline",
  "simplify-text",
  "translate-text",
  "generate-assignment-breakdown",
  "generate-topic-explanation",
  "generate-study-pack",
  "ocr-image",
  "extract-concepts",
  "review-open-answer",
  "parse-syllabus",
];
const failures = [];
const policy = await readFile("src/lib/server/ai-route-policy.ts", "utf8");
const schemas = await readFile("src/lib/server/ai-route-schemas.ts", "utf8");
const gemini = await readFile("src/lib/server/gemini.ts", "utf8");

for (const marker of [
  "Idempotency-Key",
  "AI_BUDGET_EXCEEDED",
  "AI_CONCURRENCY_LIMIT",
  "PAYLOAD_TOO_LARGE",
  "INVALID_INPUT",
  "x-request-id",
  "AbortController",
]) {
  if (!policy.includes(marker)) failures.push(\`AI route policy is missing: \${marker}\`);
}
for (const marker of ["aiGenerationInputSchema", "ocrGenerationInputSchema", "syllabusParseInputSchema"]) {
  if (!schemas.includes(marker)) failures.push(\`AI route schemas are missing: \${marker}\`);
}
for (const marker of ["PROVIDER_TIMEOUT_MS", "MAX_PROVIDER_ATTEMPTS", "signal: controller.signal"]) {
  if (!gemini.includes(marker)) failures.push(\`Gemini provider hardening is missing: \${marker}\`);
}
for (const route of routeFiles) {
  const content = await readFile(\`src/routes/api/ai/\${route}.ts\`, "utf8");
  if (!content.includes("handleAIJSONRequest")) failures.push(\`\${route} bypasses shared policy.\`);
  if (content.includes("(await request.json()) as")) failures.push(\`\${route} still trusts a raw cast.\`);
}
if (failures.length > 0) {
  console.error("AI route policy contract failed:\\n");
  failures.forEach((failure) => console.error(\`- \${failure}\`));
  process.exit(1);
}
console.log("Shared AI runtime validation and resource-control contract passed.");
`,
);

const packagePath = "package.json";
const packageJson = JSON.parse(await read(packagePath));
packageJson.scripts["verify:ai-route-policy-contract"] =
  "node scripts/verify-ai-route-policy-contract.mjs";
packageJson.scripts["eval:ai-route-policy"] =
  "node --experimental-strip-types scripts/run-ai-route-policy-evals.mjs";
await write(packagePath, JSON.stringify(packageJson, null, 2));
