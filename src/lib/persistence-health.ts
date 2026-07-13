import type { AppData } from "./store";

export const LAMDAN_DATA_STORAGE_KEY = "lamdan.data.v1";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface WorkspacePersistenceHealth {
  ok: boolean;
  serialized: string;
  expectedCharacters: number;
  persistedCharacters: number;
  error?: string;
}

export function serializeWorkspaceData(data: AppData): string {
  return JSON.stringify(data);
}

export function inspectWorkspacePersistence(
  data: AppData,
  storage: StorageLike | undefined = browserStorage(),
): WorkspacePersistenceHealth {
  const serialized = serializeWorkspaceData(data);
  if (!storage) {
    return {
      ok: true,
      serialized,
      expectedCharacters: serialized.length,
      persistedCharacters: serialized.length,
    };
  }
  try {
    const persisted = storage.getItem(LAMDAN_DATA_STORAGE_KEY);
    return {
      ok: persisted === serialized,
      serialized,
      expectedCharacters: serialized.length,
      persistedCharacters: persisted?.length ?? 0,
      error:
        persisted === serialized
          ? undefined
          : "The in-memory workspace is newer than the browser-local saved snapshot.",
    };
  } catch (error) {
    return {
      ok: false,
      serialized,
      expectedCharacters: serialized.length,
      persistedCharacters: 0,
      error: readableStorageError(error),
    };
  }
}

export function persistWorkspaceSnapshot(
  data: AppData,
  storage: StorageLike | undefined = browserStorage(),
): WorkspacePersistenceHealth {
  const serialized = serializeWorkspaceData(data);
  if (!storage) {
    return {
      ok: true,
      serialized,
      expectedCharacters: serialized.length,
      persistedCharacters: serialized.length,
    };
  }
  try {
    storage.setItem(LAMDAN_DATA_STORAGE_KEY, serialized);
    return inspectWorkspacePersistence(data, storage);
  } catch (error) {
    return {
      ok: false,
      serialized,
      expectedCharacters: serialized.length,
      persistedCharacters: safePersistedLength(storage),
      error: readableStorageError(error),
    };
  }
}

export function readableStorageError(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : String(error);
  if (name === "QuotaExceededError" || /quota|storage.*full/i.test(message)) {
    return "Browser storage is full. Export the workspace, remove unused local data, then retry.";
  }
  return message || "Browser-local storage could not be written.";
}

function browserStorage(): StorageLike | undefined {
  return typeof window === "undefined" ? undefined : window.localStorage;
}

function safePersistedLength(storage: StorageLike): number {
  try {
    return storage.getItem(LAMDAN_DATA_STORAGE_KEY)?.length ?? 0;
  } catch {
    return 0;
  }
}
