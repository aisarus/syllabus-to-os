// SERVER-ONLY. HTTP adapter joining the validated AI boundary to execution controls.

import type { ZodType } from "zod";
import { aiResultResponse, parseAIJsonRequest } from "./ai-api-contract.ts";
import {
  AIExecutionError,
  type AIExecutionContext,
  type AIExecutionOperation,
  type AIExecutionPolicy,
  aiExecutionErrorResponse,
  createAIRequestId,
  executeAIRequest,
  readIdempotencyKey,
  withAIExecutionHeaders,
} from "./ai-execution-control.ts";

export async function handleControlledAIJsonRequest<T>(
  request: Request,
  schema: ZodType<T>,
  operation: AIExecutionOperation,
  handler: (data: T, context: AIExecutionContext) => Promise<unknown>,
  options: { maxBytes?: number; estimatedCost?: number; policy?: Partial<AIExecutionPolicy> } = {},
): Promise<Response> {
  const requestId = createAIRequestId(request);
  const parsed = await parseAIJsonRequest(request, schema, { maxBytes: options.maxBytes });
  if (!parsed.ok) {
    return withAIExecutionHeaders(parsed.response, { requestId, replayed: false });
  }

  try {
    const result = await executeAIRequest({
      operation,
      input: parsed.data,
      idempotencyKey: readIdempotencyKey(request),
      estimatedCost: options.estimatedCost,
      policy: options.policy,
      dependencies: { createRequestId: () => requestId },
      handler: (context) => handler(parsed.data, context),
    });
    return withAIExecutionHeaders(aiResultResponse(result.value), result);
  } catch (error) {
    if (error instanceof AIExecutionError) return aiExecutionErrorResponse(error, requestId);
    return withAIExecutionHeaders(
      Response.json(
        { ok: false, code: "INTERNAL_ERROR", error: "AI request failed." },
        { status: 500 },
      ),
      { requestId, replayed: false },
    );
  }
}
