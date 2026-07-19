import { useSyncExternalStore } from "react";
import {
  LAMDAN_DATA_STORAGE_KEY,
  WorkspacePersistenceError,
  persistWorkspaceSnapshot,
  type StorageLike,
  type WorkspacePersistenceHealth,
} from "./persistence-health.ts";
import type { AppData } from "./store-types.ts";

const KEY = LAMDAN_DATA_STORAGE_KEY;

export const createEmptyAppData = (): AppData => ({
  version: 1,
  programs: [],
  courses: [],
  topics: [],
  notes: [],
  flashcards: [],
  quizzes: [],
  quizQuestions: [],
  quizAttempts: [],
  assignments: [],
  materials: [],
  materialChunks: [],
  materialOutputs: [],
  presentationOutlines: [],
  calendarEvents: [],
  studySessions: [],
  syllabusImports: [],
});

function load(): AppData {
  if (typeof window === "undefined") return createEmptyAppData();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return createEmptyAppData();
    const parsed = JSON.parse(raw);
    return { ...createEmptyAppData(), ...parsed };
  } catch {
    return createEmptyAppData();
  }
}

const SERVER_SNAPSHOT: AppData = createEmptyAppData();
let state: AppData = SERVER_SNAPSHOT;
let hydrated = false;
const listeners = new Set<() => void>();
const persistenceFailureListeners = new Set<() => void>();

export interface PendingWorkspacePersistenceFailure {
  candidate: AppData;
  health: WorkspacePersistenceHealth;
  error: WorkspacePersistenceError;
}

let pendingPersistenceFailure: PendingWorkspacePersistenceFailure | null = null;
type WorkspaceStorageProvider = () => StorageLike | undefined;
const defaultWorkspaceStorageProvider: WorkspaceStorageProvider = () => {
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
};
let workspaceStorageProvider: WorkspaceStorageProvider = defaultWorkspaceStorageProvider;

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  state = load();
}

function notifyDataListeners() {
  listeners.forEach((listener) => listener());
}

function notifyPersistenceFailureListeners() {
  persistenceFailureListeners.forEach((listener) => listener());
}

function recoveryCandidate(next: AppData, health: WorkspacePersistenceHealth): AppData {
  if (!health.serialized) return next;
  try {
    return JSON.parse(health.serialized) as AppData;
  } catch {
    return next;
  }
}

export function commitWorkspaceData(next: AppData): WorkspacePersistenceHealth {
  const health = persistWorkspaceSnapshot(next, workspaceStorageProvider());
  if (!health.ok) {
    const candidate = recoveryCandidate(next, health);
    const error = new WorkspacePersistenceError(candidate, health);
    pendingPersistenceFailure = { candidate, health, error };
    notifyPersistenceFailureListeners();
    throw error;
  }

  state = next;
  const hadPendingFailure = pendingPersistenceFailure !== null;
  pendingPersistenceFailure = null;
  notifyDataListeners();
  if (hadPendingFailure) notifyPersistenceFailureListeners();
  return health;
}

export function subscribeWorkspaceData(fn: () => void) {
  ensureHydrated();
  queueMicrotask(fn);
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function subscribePersistenceFailure(fn: () => void) {
  persistenceFailureListeners.add(fn);
  return () => persistenceFailureListeners.delete(fn);
}

function getSnapshot() {
  return state;
}
function getServerSnapshot() {
  return SERVER_SNAPSHOT;
}
function getPersistenceFailureSnapshot() {
  return pendingPersistenceFailure;
}
function getServerPersistenceFailureSnapshot() {
  return null;
}

export function useData(): AppData {
  return useSyncExternalStore(subscribeWorkspaceData, getSnapshot, getServerSnapshot);
}

export function useWorkspacePersistenceFailure(): PendingWorkspacePersistenceFailure | null {
  return useSyncExternalStore(
    subscribePersistenceFailure,
    getPersistenceFailureSnapshot,
    getServerPersistenceFailureSnapshot,
  );
}

export function getPendingWorkspacePersistenceFailure(): PendingWorkspacePersistenceFailure | null {
  return pendingPersistenceFailure;
}

export function retryPendingWorkspacePersistence(): WorkspacePersistenceHealth | null {
  const pending = pendingPersistenceFailure;
  if (!pending) return null;
  try {
    return commitWorkspaceData(pending.candidate);
  } catch (error) {
    if (error instanceof WorkspacePersistenceError) return error.health;
    throw error;
  }
}

export function setData(next: AppData): WorkspacePersistenceHealth {
  ensureHydrated();
  return commitWorkspaceData(next);
}

export function updateData(fn: (data: AppData) => AppData): WorkspacePersistenceHealth {
  ensureHydrated();
  const base =
    pendingPersistenceFailure?.health.serialized && pendingPersistenceFailure.candidate
      ? pendingPersistenceFailure.candidate
      : state;
  const next = fn(base);
  return commitWorkspaceData(next);
}

export const workspaceStoreTesting = {
  reset(snapshot: AppData = createEmptyAppData()) {
    state = snapshot;
    hydrated = true;
    pendingPersistenceFailure = null;
    listeners.clear();
    persistenceFailureListeners.clear();
    workspaceStorageProvider = defaultWorkspaceStorageProvider;
  },
  setStorage(storage: StorageLike | undefined) {
    const previous = workspaceStorageProvider;
    workspaceStorageProvider = () => storage;
    return () => {
      workspaceStorageProvider = previous;
    };
  },
  subscribe(listener: () => void) {
    return subscribeWorkspaceData(listener);
  },
  subscribePersistenceFailure(listener: () => void) {
    return subscribePersistenceFailure(listener);
  },
};

export function getMutationBase(): AppData {
  return pendingPersistenceFailure?.health.serialized && pendingPersistenceFailure.candidate
    ? pendingPersistenceFailure.candidate
    : state;
}

export function readPublishedWorkspaceData(): AppData {
  ensureHydrated();
  return state;
}

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}
