// SERVER-ONLY. Types and policies for process-local AI execution controls.

export type AIExecutionOperation =
  | "assignment"
  | "concept-extraction"
  | "flashcards"
  | "note"
  | "ocr"
  | "open-answer-review"
  | "presentation"
  | "quiz"
  | "simplify"
  | "study-pack"
  | "syllabus"
  | "topic"
  | "transcription"
  | "translate";

export type AIExecutionErrorCode =
  | "AI_CONCURRENCY_LIMIT"
  | "AI_RATE_LIMIT"
  | "AI_COST_LIMIT"
  | "AI_TIMEOUT"
  | "IDEMPOTENCY_CONFLICT"
  | "INVALID_IDEMPOTENCY_KEY";

export interface AIExecutionPolicy {
  timeoutMs: number;
  maxConcurrent: number;
  maxRequestsPerWindow: number;
  rateWindowMs: number;
  maxEstimatedCost: number;
  maxRetries: number;
  retryBackoffMs: number;
  idempotencyTtlMs: number;
}

export interface AIExecutionContext {
  requestId: string;
  operation: AIExecutionOperation;
  attempt: number;
}

export interface AIExecutionResult<T> {
  value: T;
  requestId: string;
  originalRequestId?: string;
  replayed: boolean;
}

export interface AIExecutionDependencies {
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  createRequestId?: () => string;
  isTransientError?: (error: unknown) => boolean;
  isTransientResult?: (value: unknown) => boolean;
}

export interface AIExecutionOptions<TInput, TResult> {
  operation: AIExecutionOperation;
  input: TInput;
  handler: (context: AIExecutionContext) => Promise<TResult>;
  idempotencyKey?: string | null;
  estimatedCost?: number;
  policy?: Partial<AIExecutionPolicy>;
  shouldCacheResult?: (value: TResult) => boolean;
  dependencies?: AIExecutionDependencies;
}

export class AIExecutionError extends Error {
  readonly code: AIExecutionErrorCode;
  readonly status: number;
  readonly retryAfterSeconds?: number;

  constructor(
    code: AIExecutionErrorCode,
    message: string,
    status: number,
    retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "AIExecutionError";
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const DEFAULT_POLICY: AIExecutionPolicy = {
  timeoutMs: 45_000,
  maxConcurrent: 3,
  maxRequestsPerWindow: 30,
  rateWindowMs: 60_000,
  maxEstimatedCost: 100,
  maxRetries: 1,
  retryBackoffMs: 250,
  idempotencyTtlMs: 5 * 60_000,
};

const POLICY_OVERRIDES: Partial<Record<AIExecutionOperation, Partial<AIExecutionPolicy>>> = {
  ocr: { timeoutMs: 60_000, maxConcurrent: 2, maxRequestsPerWindow: 12, maxEstimatedCost: 160 },
  transcription: {
    timeoutMs: 120_000,
    maxConcurrent: 1,
    maxRequestsPerWindow: 6,
    maxEstimatedCost: 300,
    maxRetries: 0,
  },
  syllabus: { timeoutMs: 60_000, maxConcurrent: 2, maxRequestsPerWindow: 12 },
  quiz: { timeoutMs: 60_000, maxConcurrent: 2, maxRequestsPerWindow: 20 },
  "study-pack": { timeoutMs: 60_000, maxConcurrent: 2, maxRequestsPerWindow: 20 },
};

export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

export function getAIExecutionPolicy(
  operation: AIExecutionOperation,
  override: Partial<AIExecutionPolicy> = {},
): AIExecutionPolicy {
  return { ...DEFAULT_POLICY, ...POLICY_OVERRIDES[operation], ...override };
}
