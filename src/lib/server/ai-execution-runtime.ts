// SERVER-ONLY. Execution, retry, timeout and idempotency orchestration.

import { createHash, randomUUID } from "node:crypto";
import {
  AIExecutionError,
  getAIExecutionPolicy,
  IDEMPOTENCY_KEY_PATTERN,
  type AIExecutionContext,
  type AIExecutionOperation,
  type AIExecutionOptions,
  type AIExecutionPolicy,
  type AIExecutionResult,
} from "./ai-execution-types.ts";
import {
  activeByOperation,
  assertMatchingInput,
  cacheCompleted,
  completedEntry,
  consumeRateBudget,
  inflightByKey,
  pruneCompleted,
} from "./ai-execution-state.ts";

export async function executeAIRequest<TInput, TResult>(
  options: AIExecutionOptions<TInput, TResult>,
): Promise<AIExecutionResult<TResult>> {
  const now = options.dependencies?.now ?? Date.now;
  const sleep =
    options.dependencies?.sleep ??
    ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const createRequestId = options.dependencies?.createRequestId ?? randomUUID;
  const isTransientError = options.dependencies?.isTransientError ?? defaultTransientError;
  const isTransientResult = options.dependencies?.isTransientResult ?? defaultTransientResult;
  const policy = getAIExecutionPolicy(options.operation, options.policy);
  const requestId = createRequestId();
  const inputHash = stableHash(options.input);
  const key = normalizeIdempotencyKey(options.operation, options.idempotencyKey);
  const timestamp = now();

  throwIfAborted(options.signal);
  pruneCompleted(timestamp);

  if (key) {
    const cached = completedEntry(key);
    if (cached) {
      assertMatchingInput(cached.inputHash, inputHash);
      return {
        value: cached.value as TResult,
        requestId,
        originalRequestId: cached.requestId,
        replayed: true,
      };
    }

    const inflight = inflightByKey.get(key);
    if (inflight) {
      assertMatchingInput(inflight.inputHash, inputHash);
      const value = (await waitForAbort(inflight.promise, options.signal)) as TResult;
      return {
        value,
        requestId,
        originalRequestId: inflight.requestId,
        replayed: true,
      };
    }
  }

  const estimatedCost = options.estimatedCost ?? estimateInputCost(options.input);
  if (
    !Number.isFinite(estimatedCost) ||
    estimatedCost < 0 ||
    estimatedCost > policy.maxEstimatedCost
  ) {
    throw new AIExecutionError(
      "AI_COST_LIMIT",
      "AI request exceeds the operation cost budget.",
      413,
    );
  }

  const active = activeByOperation.get(options.operation) ?? 0;
  if (active >= policy.maxConcurrent) {
    throw new AIExecutionError(
      "AI_CONCURRENCY_LIMIT",
      "AI operation is busy. Try again shortly.",
      429,
      1,
    );
  }

  consumeRateBudget(options.operation, timestamp, policy);
  activeByOperation.set(options.operation, active + 1);

  const cancellation = createExecutionCancellation(options.signal, policy.timeoutMs);
  const operationPromise = runWithRetries({
    operation: options.operation,
    handler: options.handler,
    requestId,
    policy,
    sleep,
    signal: cancellation.signal,
    isTransientError,
    isTransientResult,
  });
  const settledOperation = operationPromise.finally(() => {
    cancellation.dispose();
    activeByOperation.set(
      options.operation,
      Math.max(0, (activeByOperation.get(options.operation) ?? 1) - 1),
    );
    if (key && inflightByKey.get(key)?.requestId === requestId) inflightByKey.delete(key);
  });
  const controlledOperation = waitForAbort(settledOperation, cancellation.signal);

  if (key) inflightByKey.set(key, { inputHash, requestId, promise: controlledOperation });

  const value = await controlledOperation;
  throwIfAborted(cancellation.signal);
  const shouldCache = options.shouldCacheResult ?? defaultShouldCacheResult;
  if (key && shouldCache(value)) {
    cacheCompleted(
      key,
      {
        inputHash,
        requestId,
        value,
        expiresAt: now() + policy.idempotencyTtlMs,
      },
      estimateSerializedBytes,
    );
  }
  return { value, requestId, replayed: false };
}

async function runWithRetries<TResult>(options: {
  operation: AIExecutionOperation;
  handler: (context: AIExecutionContext) => Promise<TResult>;
  requestId: string;
  policy: AIExecutionPolicy;
  sleep: (ms: number) => Promise<void>;
  signal: AbortSignal;
  isTransientError: (error: unknown) => boolean;
  isTransientResult: (value: unknown) => boolean;
}): Promise<TResult> {
  for (let attempt = 0; ; attempt += 1) {
    throwIfAborted(options.signal);
    try {
      const value = await options.handler({
        requestId: options.requestId,
        operation: options.operation,
        attempt,
        signal: options.signal,
      });
      throwIfAborted(options.signal);
      if (attempt < options.policy.maxRetries && options.isTransientResult(value)) {
        await waitForAbort(
          options.sleep(options.policy.retryBackoffMs * 2 ** attempt),
          options.signal,
        );
        continue;
      }
      return value;
    } catch (error) {
      if (isAbortError(error) || options.signal.aborted) throw abortReason(options.signal);
      if (attempt >= options.policy.maxRetries || !options.isTransientError(error)) throw error;
      await waitForAbort(
        options.sleep(options.policy.retryBackoffMs * 2 ** attempt),
        options.signal,
      );
    }
  }
}

interface ExecutionCancellation {
  signal: AbortSignal;
  dispose(): void;
}

function createExecutionCancellation(
  externalSignal: AbortSignal | undefined,
  timeoutMs: number,
): ExecutionCancellation {
  const controller = new AbortController();
  const onExternalAbort = () => controller.abort(abortReason(externalSignal));
  if (externalSignal?.aborted) onExternalAbort();
  else externalSignal?.addEventListener("abort", onExternalAbort, { once: true });

  const timer = setTimeout(() => {
    controller.abort(new AIExecutionError("AI_TIMEOUT", "AI operation timed out.", 504));
  }, timeoutMs);

  return {
    signal: controller.signal,
    dispose() {
      clearTimeout(timer);
      externalSignal?.removeEventListener("abort", onExternalAbort);
    },
  };
}

async function waitForAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  throwIfAborted(signal);
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortReason(signal));
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortReason(signal);
}

function abortReason(signal?: AbortSignal): AIExecutionError {
  if (signal?.reason instanceof AIExecutionError) return signal.reason;
  return new AIExecutionError("AI_CANCELLED", "AI request cancelled.", 499);
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

function normalizeIdempotencyKey(
  operation: AIExecutionOperation,
  key?: string | null,
): string | null {
  const normalized = key?.trim();
  if (!normalized || !IDEMPOTENCY_KEY_PATTERN.test(normalized)) return null;
  return `${operation}:${normalized}`;
}

function defaultShouldCacheResult(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return true;
  return (value as { ok?: unknown }).ok !== false;
}

function stableHash(input: unknown): string {
  return createHash("sha256").update(stableSerialize(input)).digest("hex");
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? String(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => `${JSON.stringify(key)}:${stableSerialize(child)}`)
    .join(",")}}`;
}

function estimateInputCost(input: unknown): number {
  return Math.max(1, Math.ceil(estimateSerializedBytes(input) / 100_000));
}

function estimateSerializedBytes(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function defaultTransientResult(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const result = value as { ok?: unknown; error?: unknown };
  if (result.ok !== false || typeof result.error !== "string") return false;
  if (/not configured|invalid input|invalid request|schema/i.test(result.error)) return false;
  return /timeout|timed out|temporar|rate limit|too many requests|overload|429|502|503|504|ECONNRESET|ETIMEDOUT/i.test(
    result.error,
  );
}

function defaultTransientError(error: unknown): boolean {
  if (isAbortError(error)) return false;
  if (!error || typeof error !== "object") return false;
  const record = error as { status?: unknown; code?: unknown };
  if (typeof record.status === "number" && [408, 429, 500, 502, 503, 504].includes(record.status))
    return true;
  return (
    typeof record.code === "string" &&
    ["ECONNRESET", "ETIMEDOUT", "EAI_AGAIN"].includes(record.code)
  );
}
