import type { AutomaticTranscriptionJob } from "./automatic-transcription";

const DATABASE_NAME = "lamdan-automatic-transcription";
const DATABASE_VERSION = 1;
const JOB_STORE = "jobs";

export async function getAutomaticTranscriptionJob(
  materialId: string,
): Promise<AutomaticTranscriptionJob | undefined> {
  const db = await openDatabase();
  return readRecord<AutomaticTranscriptionJob>(db, materialId);
}

export async function putAutomaticTranscriptionJob(
  job: AutomaticTranscriptionJob,
): Promise<AutomaticTranscriptionJob> {
  const normalized: AutomaticTranscriptionJob = {
    ...job,
    uploadProgress: Math.max(0, Math.min(1, Number(job.uploadProgress) || 0)),
    resultSegments: Array.isArray(job.resultSegments) ? job.resultSegments : [],
    warnings: Array.from(new Set(Array.isArray(job.warnings) ? job.warnings : [])),
    updatedAt: Date.now(),
  };
  const db = await openDatabase();
  await writeRecord(db, normalized);
  return normalized;
}

export async function deleteAutomaticTranscriptionJob(materialId: string): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(JOB_STORE, "readwrite");
    transaction.objectStore(JOB_STORE).delete(materialId);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Could not delete the transcription job."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Transcription job deletion was aborted."));
  });
}

export async function listAutomaticTranscriptionJobs(): Promise<AutomaticTranscriptionJob[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(JOB_STORE, "readonly");
    const request = transaction.objectStore(JOB_STORE).getAll();
    request.onsuccess = () => resolve(request.result as AutomaticTranscriptionJob[]);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not read automatic transcription jobs."));
  });
}

export async function pruneAutomaticTranscriptionJobs(
  validMaterialIds: Iterable<string>,
): Promise<number> {
  const valid = new Set(validMaterialIds);
  const jobs = await listAutomaticTranscriptionJobs();
  const orphanIds = jobs.filter((job) => !valid.has(job.materialId)).map((job) => job.materialId);
  for (const materialId of orphanIds) await deleteAutomaticTranscriptionJob(materialId);
  return orphanIds.length;
}

export async function clearAutomaticTranscriptionJobs(): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(JOB_STORE, "readwrite");
    transaction.objectStore(JOB_STORE).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Could not clear transcription jobs."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Clearing transcription jobs was aborted."));
  });
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
      reject(request.error ?? new Error("Could not open automatic transcription storage."));
    request.onblocked = () =>
      reject(new Error("Automatic transcription storage is blocked by another tab."));
  });
}

function readRecord<T>(db: IDBDatabase, key: IDBValidKey): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(JOB_STORE, "readonly");
    const request = transaction.objectStore(JOB_STORE).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not read the automatic transcription job."));
  });
}

function writeRecord(db: IDBDatabase, value: AutomaticTranscriptionJob): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(JOB_STORE, "readwrite");
    transaction.objectStore(JOB_STORE).put(value);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Could not save the automatic transcription job."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Automatic transcription job save was aborted."));
  });
}
