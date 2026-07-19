import type { AppData } from "./store.ts";

export const LAMDAN_DATA_STORAGE_KEY = "lamdan.data.v1";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type WorkspacePersistenceFailureKind =
  | "quota"
  | "unavailable"
  | "serialization"
  | "write"
  | "verification";

export interface WorkspacePersistenceHealth {
  ok: boolean;
  serialized: string;
  expectedCharacters: number;
  persistedCharacters: number;
  failureKind?: WorkspacePersistenceFailureKind;
  error?: string;
}

export class WorkspacePersistenceError extends Error {
  readonly health: WorkspacePersistenceHealth;
  readonly candidate: AppData;

  constructor(candidate: AppData, health: WorkspacePersistenceHealth) {
    super(health.error ?? "Browser-local workspace persistence failed.");
    this.name = "WorkspacePersistenceError";
    this.candidate = candidate;
    this.health = health;
  }
}

export function serializeWorkspaceData(data: AppData): string {
  return JSON.stringify(data);
}

export function inspectWorkspacePersistence(
  data: AppData,
  storage: StorageLike | undefined = browserStorage(),
): WorkspacePersistenceHealth {
  const serialization = trySerializeWorkspaceData(data);
  if (!serialization.ok) return serialization.health;

  const { serialized } = serialization;
  if (!storage) return successfulHealth(serialized);

  return inspectSerializedWorkspace(serialized, storage);
}

export function persistWorkspaceSnapshot(
  data: AppData,
  storage: StorageLike | undefined = browserStorage(),
): WorkspacePersistenceHealth {
  const serialization = trySerializeWorkspaceData(data);
  if (!serialization.ok) return serialization.health;

  const { serialized } = serialization;
  if (!storage) return successfulHealth(serialized);

  try {
    storage.setItem(LAMDAN_DATA_STORAGE_KEY, serialized);
  } catch (error) {
    return failedHealth(serialized, safePersistedLength(storage), error, "write");
  }

  return inspectSerializedWorkspace(serialized, storage);
}

export function readableStorageError(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : String(error);
  if (name === "QuotaExceededError" || /quota|storage.*full/i.test(message)) {
    return "Browser storage is full. Export the recovery candidate, remove unused local data, then retry.";
  }
  if (
    name === "SecurityError" ||
    /storage.*(?:unavailable|disabled|denied)|access.*denied|not available/i.test(message)
  ) {
    return "Browser-local storage is unavailable. Check browser privacy settings, then retry.";
  }
  return message || "Browser-local storage could not be written.";
}

function inspectSerializedWorkspace(
  serialized: string,
  storage: StorageLike,
): WorkspacePersistenceHealth {
  try {
    const persisted = storage.getItem(LAMDAN_DATA_STORAGE_KEY);
    if (persisted === serialized) return successfulHealth(serialized);
    return {
      ok: false,
      serialized,
      expectedCharacters: serialized.length,
      persistedCharacters: persisted?.length ?? 0,
      failureKind: "verification",
      error: "The browser-local value did not match the workspace candidate after writing.",
    };
  } catch (error) {
    return failedHealth(serialized, 0, error, "unavailable");
  }
}

function trySerializeWorkspaceData(
  data: AppData,
): { ok: true; serialized: string } | { ok: false; health: WorkspacePersistenceHealth } {
  try {
    return { ok: true, serialized: serializeWorkspaceData(data) };
  } catch (error) {
    return {
      ok: false,
      health: {
        ok: false,
        serialized: "",
        expectedCharacters: 0,
        persistedCharacters: 0,
        failureKind: "serialization",
        error:
          error instanceof Error && error.message
            ? `Workspace serialization failed: ${error.message}`
            : "Workspace serialization failed.",
      },
    };
  }
}

function successfulHealth(serialized: string): WorkspacePersistenceHealth {
  return {
    ok: true,
    serialized,
    expectedCharacters: serialized.length,
    persistedCharacters: serialized.length,
  };
}

function failedHealth(
  serialized: string,
  persistedCharacters: number,
  error: unknown,
  fallbackKind: "write" | "unavailable",
): WorkspacePersistenceHealth {
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : String(error);
  const failureKind: WorkspacePersistenceFailureKind =
    name === "QuotaExceededError" || /quota|storage.*full/i.test(message)
      ? "quota"
      : name === "SecurityError" ||
          /storage.*(?:unavailable|disabled|denied)|access.*denied|not available/i.test(message)
        ? "unavailable"
        : fallbackKind;
  return {
    ok: false,
    serialized,
    expectedCharacters: serialized.length,
    persistedCharacters,
    failureKind,
    error: readableStorageError(error),
  };
}

function browserStorage(): StorageLike | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return {
      getItem() {
        const error = new Error("Browser-local storage is unavailable.");
        error.name = "SecurityError";
        throw error;
      },
      setItem() {
        const error = new Error("Browser-local storage is unavailable.");
        error.name = "SecurityError";
        throw error;
      },
    };
  }
}

function safePersistedLength(storage: StorageLike): number {
  try {
    return storage.getItem(LAMDAN_DATA_STORAGE_KEY)?.length ?? 0;
  } catch {
    return 0;
  }
}
