import { createHash, randomUUID } from "node:crypto";
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
    ? `${clientKey}:${options.operation}:${idempotencyKey}`
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
    return errorResponse(
      requestId,
      429,
      "RATE_LIMITED",
      "Too many AI requests. Try again later.",
      undefined,
      {
        "retry-after": "60",
      },
    );
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
      .then(
        (result): StoredResult => ({
          payload: normalizeResult(result),
          status: options.statusForResult?.(result) ?? statusForAIResult(result),
        }),
      )
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
  return hash(parts.map((part) => String(part ?? "")).join(""));
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
  return {
    ok: false,
    error: message,
    code,
    retryable,
    ...(details === undefined ? {} : { details }),
  };
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
  const next =
    !current || now - current.startedAt >= windowMs ? { startedAt: now, value: 0 } : current;
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
