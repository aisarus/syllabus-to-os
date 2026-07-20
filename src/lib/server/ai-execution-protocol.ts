// SERVER-ONLY. HTTP metadata for AI execution controls.

import { randomUUID } from "node:crypto";
import {
  AIExecutionError,
  IDEMPOTENCY_KEY_PATTERN,
  type AIExecutionResult,
} from "./ai-execution-types.ts";

export function readIdempotencyKey(request: Request): string | null {
  const raw = request.headers.get("idempotency-key")?.trim();
  if (!raw) return null;
  if (!IDEMPOTENCY_KEY_PATTERN.test(raw)) {
    throw new AIExecutionError(
      "INVALID_IDEMPOTENCY_KEY",
      "Idempotency key must be 8-128 URL-safe characters.",
      400,
    );
  }
  return raw;
}

export function createAIRequestId(request: Request, factory: () => string = randomUUID): string {
  const supplied = request.headers.get("x-request-id")?.trim();
  if (supplied && IDEMPOTENCY_KEY_PATTERN.test(supplied)) return supplied;
  return factory();
}

export function withAIExecutionHeaders(
  response: Response,
  result: Pick<AIExecutionResult<unknown>, "requestId" | "originalRequestId" | "replayed">,
): Response {
  const headers = new Headers(response.headers);
  headers.set("x-request-id", result.requestId);
  if (result.replayed) headers.set("x-idempotent-replay", "true");
  if (result.originalRequestId) headers.set("x-original-request-id", result.originalRequestId);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function aiExecutionErrorResponse(error: AIExecutionError, requestId: string): Response {
  const headers = new Headers({ "content-type": "application/json", "x-request-id": requestId });
  if (error.retryAfterSeconds !== undefined) {
    headers.set("retry-after", String(error.retryAfterSeconds));
  }
  return new Response(JSON.stringify({ ok: false, code: error.code, error: error.message }), {
    status: error.status,
    headers,
  });
}
