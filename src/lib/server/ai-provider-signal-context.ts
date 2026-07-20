// SERVER-ONLY. Request-scoped provider cancellation context.

import { AsyncLocalStorage } from "node:async_hooks";

const providerSignalStorage = new AsyncLocalStorage<AbortSignal>();

export function runWithAIProviderSignal<T>(signal: AbortSignal, callback: () => T): T {
  return providerSignalStorage.run(signal, callback);
}

export function currentAIProviderSignal(): AbortSignal | undefined {
  return providerSignalStorage.getStore();
}
