import type {
  ResumableTranscriptionJob,
  ResumableTranscriptionRange,
} from "./resumable-transcription";

const DATABASE_NAME = "lamdan-resumable-transcription";
const DATABASE_VERSION = 1;
const JOB_STORE = "jobs";

export async function getResumableTranscriptionJob(
  materialId: string,
): Promise<ResumableTranscriptionJob | undefined> {
  const db = await openDatabase();
  const record = await readRecord<ResumableTranscriptionJob>(db, materialId);
  return record ? normalizeJob(record) : undefined;
}

export async function putResumableTranscriptionJob(
  job: ResumableTranscriptionJob,
): Promise<ResumableTranscriptionJob> {
  const normalized = normalizeJob({ ...job, updatedAt: Date.now() });
  const db = await openDatabase();
  await writeRecord(db, normalized);
  return normalized;
}

export async function deleteResumableTranscriptionJob(materialId: string): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(JOB_STORE, "readwrite");
    transaction.objectStore(JOB_STORE).delete(materialId);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Could not delete the resumable transcription job."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Resumable transcription job deletion was aborted."));
  });
}

export async function listResumableTranscriptionJobs(): Promise<ResumableTranscriptionJob[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(JOB_STORE, "readonly");
    const request = transaction.objectStore(JOB_STORE).getAll();
    request.onsuccess = () =>
      resolve((request.result as ResumableTranscriptionJob[]).map((job) => normalizeJob(job)));
    request.onerror = () =>
      reject(request.error ?? new Error("Could not read resumable transcription jobs."));
  });
}

export async function pruneResumableTranscriptionJobs(
  validMaterialIds: Iterable<string>,
): Promise<number> {
  const valid = new Set(validMaterialIds);
  const jobs = await listResumableTranscriptionJobs();
  const orphanIds = jobs.filter((job) => !valid.has(job.materialId)).map((job) => job.materialId);
  for (const materialId of orphanIds) await deleteResumableTranscriptionJob(materialId);
  return orphanIds.length;
}

export async function clearResumableTranscriptionJobs(): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(JOB_STORE, "readwrite");
    transaction.objectStore(JOB_STORE).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Could not clear resumable transcription jobs."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Clearing resumable transcription jobs was aborted."));
  });
}

function normalizeJob(job: ResumableTranscriptionJob): ResumableTranscriptionJob {
  return {
    ...job,
    durationSeconds: Math.max(0, Number(job.durationSeconds) || 0),
    rangeSeconds: Math.max(60, Number(job.rangeSeconds) || 15 * 60),
    overlapSeconds: Math.max(0, Number(job.overlapSeconds) || 0),
    ranges: Array.isArray(job.ranges) ? job.ranges.map((range, index) => normalizeRange(range, index)) : [],
    createdAt: Number(job.createdAt) || Date.now(),
    updatedAt: Number(job.updatedAt) || Date.now(),
  };
}

function normalizeRange(
  range: ResumableTranscriptionRange,
  fallbackIndex: number,
): ResumableTranscriptionRange {
  const startSeconds = Math.max(0, Number(range.startSeconds) || 0);
  const endSeconds = Math.max(startSeconds + 0.01, Number(range.endSeconds) || startSeconds + 1);
  return {
    ...range,
    id: range.id || `range_${fallbackIndex}_${Math.round(startSeconds * 1000)}`,
    index: Number.isInteger(range.index) ? range.index : fallbackIndex,
    startSeconds,
    endSeconds,
    attempt: Math.max(0, Number(range.attempt) || 0),
    uploadProgress: Math.max(0, Math.min(1, Number(range.uploadProgress) || 0)),
    resultSegments: Array.isArray(range.resultSegments) ? range.resultSegments : [],
    warnings: Array.from(new Set(Array.isArray(range.warnings) ? range.warnings : [])),
    updatedAt: Number(range.updatedAt) || Date.now(),
  };
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is not available in this browser."));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(JOB_STORE)) {
        db.createObjectStore(JOB_STORE, { keyPath: "materialId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not open resumable transcription storage."));
    request.onblocked = () =>
      reject(new Error("Resumable transcription storage is blocked by another tab."));
  });
}

function readRecord<T>(db: IDBDatabase, key: IDBValidKey): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(JOB_STORE, "readonly");
    const request = transaction.objectStore(JOB_STORE).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not read the resumable transcription job."));
  });
}

function writeRecord(db: IDBDatabase, value: ResumableTranscriptionJob): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(JOB_STORE, "readwrite");
    transaction.objectStore(JOB_STORE).put(value);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Could not save the resumable transcription job."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Resumable transcription job save was aborted."));
  });
}
