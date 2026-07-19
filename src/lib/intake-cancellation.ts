export class IntakeCancelledError extends Error {
  constructor(message = "Material processing was cancelled.") {
    super(message);
    this.name = "AbortError";
  }
}

export function throwIfIntakeCancelled(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  const reason = signal.reason;
  if (reason instanceof Error && reason.name === "AbortError") throw reason;
  if (reason instanceof Error) throw new IntakeCancelledError(reason.message);
  throw new IntakeCancelledError();
}

export function isIntakeCancellation(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  return error instanceof Error && error.name === "AbortError";
}
