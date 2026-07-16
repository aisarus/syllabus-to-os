import type { LocalRangeExtractionResult } from "./local-range-extraction";

const DATABASE_NAME = "lamdan-range-extraction";
const DATABASE_VERSION = 1;
const CLIP_STORE = "clips";
const BY_MATERIAL_INDEX = "by-material";

export interface LocalRangeClipRecord {
  materialId: string;
  rangeId: string;
  sourceUploadId: string;
  startSeconds: number;
  endSeconds: number;
  expectedDurationSeconds: number;
  capturedDurationSeconds: number;
  measuredBlobDurationSeconds?: number;
  fileName: string;
  mimeType: string;
  size: number;
  blob: Blob;
  createdAt: number;
  updatedAt: number;
}

export async function putLocalRangeClip(
  materialId: string,
  rangeId: string,
  result: LocalRangeExtractionResult,
): Promise<LocalRangeClipRecord> {
  const now = Date.now();
  const record: LocalRangeClipRecord = {
    materialId,
    rangeId,
    sourceUploadId: result.sourceUploadId,
    startSeconds: result.startSeconds,
    endSeconds: result.endSeconds,
    expectedDurationSeconds: result.expectedDurationSeconds,
    capturedDurationSeconds: result.capturedDurationSeconds,
    measuredBlobDurationSeconds: result.measuredBlobDurationSeconds,
    fileName: result.file.name,
    mimeType: result.mimeType,
    size: result.blob.size,
    blob: result.blob,
    createdAt: now,
    updatedAt: now,
  };
  const db = await openDatabase();
  await writeRecord(db, record);
  return record;
}

export async function getLocalRangeClip(
  materialId: string,
  rangeId: string,
): Promise<LocalRangeClipRecord | undefined> {
  const db = await openDatabase();
  return readRecord<LocalRangeClipRecord>(db, [materialId, rangeId]);
}

export async function listLocalRangeClips(materialId?: string): Promise<LocalRangeClipRecord[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CLIP_STORE, "readonly");
    const objectStore = transaction.objectStore(CLIP_STORE);
    const request = materialId
      ? objectStore.index(BY_MATERIAL_INDEX).getAll(materialId)
      : objectStore.getAll();
    request.onsuccess = () => resolve(request.result as LocalRangeClipRecord[]);
    request.onerror = () => reject(request.error ?? new Error("Could not list local range clips."));
  });
}

export async function deleteLocalRangeClip(materialId: string, rangeId: string): Promise<void> {
  const db = await openDatabase();
  await deleteRecord(db, [materialId, rangeId]);
}

export async function deleteLocalRangeClipsForMaterial(materialId: string): Promise<number> {
  const clips = await listLocalRangeClips(materialId);
  for (const clip of clips) await deleteLocalRangeClip(clip.materialId, clip.rangeId);
  return clips.length;
}

export async function pruneLocalRangeClips(validMaterialIds: Iterable<string>): Promise<number> {
  const valid = new Set(validMaterialIds);
  const clips = await listLocalRangeClips();
  const orphaned = clips.filter((clip) => !valid.has(clip.materialId));
  for (const clip of orphaned) await deleteLocalRangeClip(clip.materialId, clip.rangeId);
  return orphaned.length;
}

export async function clearLocalRangeClips(): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(CLIP_STORE, "readwrite");
    transaction.objectStore(CLIP_STORE).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Could not clear local range clips."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Clearing local range clips was aborted."));
  });
}

export function localRangeClipToFile(record: LocalRangeClipRecord): File {
  return new File([record.blob], record.fileName, {
    type: record.mimeType,
    lastModified: record.updatedAt,
  });
}

export async function getLocalRangeClipStats(): Promise<{
  clipCount: number;
  totalBytes: number;
}> {
  const clips = await listLocalRangeClips();
  return {
    clipCount: clips.length,
    totalBytes: clips.reduce((sum, clip) => sum + clip.size, 0),
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
      if (!db.objectStoreNames.contains(CLIP_STORE)) {
        const store = db.createObjectStore(CLIP_STORE, { keyPath: ["materialId", "rangeId"] });
        store.createIndex(BY_MATERIAL_INDEX, "materialId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not open local range clip storage."));
    request.onblocked = () =>
      reject(new Error("Local range clip storage is blocked by another tab."));
  });
}

function readRecord<T>(db: IDBDatabase, key: IDBValidKey): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CLIP_STORE, "readonly");
    const request = transaction.objectStore(CLIP_STORE).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not read a local range clip."));
  });
}

function writeRecord(db: IDBDatabase, value: LocalRangeClipRecord): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CLIP_STORE, "readwrite");
    transaction.objectStore(CLIP_STORE).put(value);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Could not save a local range clip."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Local range clip save was aborted."));
  });
}

function deleteRecord(db: IDBDatabase, key: IDBValidKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CLIP_STORE, "readwrite");
    transaction.objectStore(CLIP_STORE).delete(key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Could not delete a local range clip."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Local range clip deletion was aborted."));
  });
}
