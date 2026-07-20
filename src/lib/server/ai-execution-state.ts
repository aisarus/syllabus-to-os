// SERVER-ONLY. Process-local rate and idempotency state.

import {
  AIExecutionError,
  type AIExecutionOperation,
  type AIExecutionPolicy,
} from "./ai-execution-types.ts";

interface RateWindow {
  startedAt: number;
  count: number;
}

interface CachedExecution {
  inputHash: string;
  requestId: string;
  value: unknown;
  expiresAt: number;
  byteSize: number;
}

export interface InflightExecution {
  inputHash: string;
  requestId: string;
  promise: Promise<unknown>;
}

const MAX_IDEMPOTENCY_ENTRIES = 200;
const MAX_CACHED_RESPONSE_BYTES = 512_000;

export const activeByOperation = new Map<AIExecutionOperation, number>();
const rateByOperation = new Map<AIExecutionOperation, RateWindow>();
const completedByKey = new Map<string, CachedExecution>();
export const inflightByKey = new Map<string, InflightExecution>();

export function completedEntry(key: string): CachedExecution | undefined {
  return completedByKey.get(key);
}

export function consumeRateBudget(
  operation: AIExecutionOperation,
  now: number,
  policy: AIExecutionPolicy,
): void {
  const existing = rateByOperation.get(operation);
  const window =
    !existing || now - existing.startedAt >= policy.rateWindowMs
      ? { startedAt: now, count: 0 }
      : existing;
  if (window.count >= policy.maxRequestsPerWindow) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((policy.rateWindowMs - (now - window.startedAt)) / 1000),
    );
    throw new AIExecutionError(
      "AI_RATE_LIMIT",
      "AI request rate limit exceeded.",
      429,
      retryAfterSeconds,
    );
  }
  window.count += 1;
  rateByOperation.set(operation, window);
}

export function assertMatchingInput(expected: string, actual: string): void {
  if (expected !== actual) {
    throw new AIExecutionError(
      "IDEMPOTENCY_CONFLICT",
      "Idempotency key was already used with different input.",
      409,
    );
  }
}

export function cacheCompleted(
  key: string,
  value: Omit<CachedExecution, "byteSize">,
  estimateBytes: (value: unknown) => number,
): void {
  const byteSize = estimateBytes(value.value);
  if (byteSize > MAX_CACHED_RESPONSE_BYTES) return;
  completedByKey.delete(key);
  completedByKey.set(key, { ...value, byteSize });
  while (completedByKey.size > MAX_IDEMPOTENCY_ENTRIES) {
    const oldestKey = completedByKey.keys().next().value as string | undefined;
    if (!oldestKey) break;
    completedByKey.delete(oldestKey);
  }
}

export function pruneCompleted(now: number): void {
  for (const [key, entry] of completedByKey) {
    if (entry.expiresAt <= now) completedByKey.delete(key);
  }
}

export function resetAIExecutionStateForTests(): void {
  activeByOperation.clear();
  rateByOperation.clear();
  completedByKey.clear();
  inflightByKey.clear();
}
