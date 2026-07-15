import { useSyncExternalStore } from "react";
import type {
  LongMediaTranscriptionJob,
  LongMediaTranscriptionRange,
} from "./long-media-transcription";

const KEY = "lamdan.long-media-transcription.v1";

export interface LongMediaTranscriptionData {
  version: 1;
  jobs: LongMediaTranscriptionJob[];
}

const empty = (): LongMediaTranscriptionData => ({ version: 1, jobs: [] });
const SERVER_SNAPSHOT = empty();
let state: LongMediaTranscriptionData = SERVER_SNAPSHOT;
let hydrated = false;
const listeners = new Set<() => void>();

function load(): LongMediaTranscriptionData {
  if (typeof window === "undefined") return empty();
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<LongMediaTranscriptionData> | null;
    if (!parsed || !Array.isArray(parsed.jobs)) return empty();
    return {
      version: 1,
      jobs: parsed.jobs.filter(isSafeJob).map(normalizeJob),
    };
  } catch {
    return empty();
  }
}

function ensureHydrated(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  state = load();
}

function persist(): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(KEY, JSON.stringify(state));
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  ensureHydrated();
  queueMicrotask(listener);
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLongMediaTranscriptionData(): LongMediaTranscriptionData {
  return useSyncExternalStore(subscribe, () => state, () => SERVER_SNAPSHOT);
}

export function getLongMediaTranscriptionData(): LongMediaTranscriptionData {
  ensureHydrated();
  return state;
}

export function getLongMediaTranscriptionJob(
  materialId: string,
): LongMediaTranscriptionJob | undefined {
  ensureHydrated();
  return state.jobs.find((job) => job.materialId === materialId);
}

function updateData(
  updater: (current: LongMediaTranscriptionData) => LongMediaTranscriptionData,
): void {
  ensureHydrated();
  state = updater(state);
  persist();
}

export const longMediaTranscriptionStore = {
  replaceJob(job: LongMediaTranscriptionJob): LongMediaTranscriptionJob {
    const safe = normalizeJob(job);
    updateData((current) => ({
      version: 1,
      jobs: [safe, ...current.jobs.filter((item) => item.materialId !== safe.materialId)],
    }));
    return safe;
  },

  patchJob(
    materialId: string,
    patch: Partial<Omit<LongMediaTranscriptionJob, "materialId" | "ranges">> & {
      ranges?: LongMediaTranscriptionRange[];
    },
  ): LongMediaTranscriptionJob | undefined {
    let updated: LongMediaTranscriptionJob | undefined;
    updateData((current) => ({
      version: 1,
      jobs: current.jobs.map((job) => {
        if (job.materialId !== materialId) return job;
        updated = normalizeJob({ ...job, ...patch, materialId, updatedAt: Date.now() });
        return updated;
      }),
    }));
    return updated;
  },

  patchRange(
    materialId: string,
    rangeId: string,
    patch: Partial<Omit<LongMediaTranscriptionRange, "id">>,
  ): LongMediaTranscriptionJob | undefined {
    const job = getLongMediaTranscriptionJob(materialId);
    if (!job) return undefined;
    return this.patchJob(materialId, {
      ranges: job.ranges.map((range) =>
        range.id === rangeId ? { ...range, ...patch, id: range.id, updatedAt: Date.now() } : range,
      ),
    });
  },

  removeJob(materialId: string): void {
    updateData((current) => ({
      version: 1,
      jobs: current.jobs.filter((job) => job.materialId !== materialId),
    }));
  },

  clear(): void {
    state = empty();
    persist();
  },
};

function isSafeJob(value: unknown): value is LongMediaTranscriptionJob {
  if (!value || typeof value !== "object") return false;
  const job = value as Partial<LongMediaTranscriptionJob> & Record<string, unknown>;
  return (
    typeof job.id === "string" &&
    typeof job.materialId === "string" &&
    typeof job.sourceUploadId === "string" &&
    job.provider === "google-gemini-files" &&
    Array.isArray(job.ranges) &&
    !("uploadUrl" in job) &&
    !("apiKey" in job)
  );
}

function normalizeJob(job: LongMediaTranscriptionJob): LongMediaTranscriptionJob {
  const ranges = job.ranges
    .filter(
      (range) =>
        typeof range.id === "string" &&
        Number.isFinite(range.startSeconds) &&
        Number.isFinite(range.endSeconds) &&
        range.endSeconds > range.startSeconds,
    )
    .map((range) => ({
      ...range,
      attempts: Math.max(0, Math.floor(range.attempts || 0)),
      segmentCount: Math.max(0, Math.floor(range.segmentCount || 0)),
    }))
    .sort((left, right) => left.startSeconds - right.startSeconds);
  return {
    ...job,
    ranges,
    uploadedBytes: Math.max(0, Math.min(job.fileSize, job.uploadedBytes || 0)),
    updatedAt: Number.isFinite(job.updatedAt) ? job.updatedAt : Date.now(),
  };
}
