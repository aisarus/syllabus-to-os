import type {
  LocalRangeExtractionIdentity,
  LocalRangeExtractionProvenance,
} from "./local-range-extraction";

const DATABASE_NAME = "lamdan-local-range-extraction";
const DATABASE_VERSION = 1;
const CLIP_STORE = "clips";
const CHUNK_STORE = "chunks";
const CHUNKS_BY_CLIP = "by-clip";

export interface LocalRangeExtractionClipRecord extends LocalRangeExtractionIdentity {
  id: string;
  status: "staging" | "ready";
  fileName: string;
  mimeType: string;
  estimatedBytes: number;
  chunkCount: number;
  byteSize: number;
  durationSeconds?: number;
  wallTimeMilliseconds?: number;
  mainThreadBusyMilliseconds?: number;
  createdAt: number;
  updatedAt: number;
}

interface LocalRangeExtractionChunkRecord {
  clipId: string;
  index: number;
  blob: Blob;
  size: number;
  createdAt: number;
}

function uid(prefix: string): string {
  return `${prefix}_${crypto.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
}

export async function beginLocalRangeExtractionStage(
  input: LocalRangeExtractionIdentity & {
    fileName: string;
    mimeType: string;
    estimatedBytes: number;
  },
): Promise<LocalRangeExtractionClipRecord> {
  const now = Date.now();
  const record: LocalRangeExtractionClipRecord = {
    ...input,
    id: uid("local_clip"),
    status: "staging",
    estimatedBytes: Math.max(0, Math.round(input.estimatedBytes) || 0),
    chunkCount: 0,
    byteSize: 0,
    createdAt: now,
    updatedAt: now,
  };
  const db = await openDatabase();
  await writeRecord(db, CLIP_STORE, record);
  return record;
}

export async function appendLocalRangeExtractionChunk(
  clipId: string,
  blob: Blob,
): Promise<LocalRangeExtractionClipRecord> {
  if (blob.size <= 0) {
    const existing = await getLocalRangeExtractionClip(clipId);
    if (!existing) throw new Error("The local recording stage was not found.");
    return existing;
  }
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CLIP_STORE, CHUNK_STORE], "readwrite");
    const clips = transaction.objectStore(CLIP_STORE);
    const request = clips.get(clipId);
    let next: LocalRangeExtractionClipRecord | undefined;
    let writeError: unknown;
    request.onsuccess = () => {
      try {
        const current = request.result as LocalRangeExtractionClipRecord | undefined;
        if (!current || current.status !== "staging") {
          throw new Error("The local recording stage is no longer writable.");
        }
        next = {
          ...current,
          chunkCount: current.chunkCount + 1,
          byteSize: current.byteSize + blob.size,
          updatedAt: Date.now(),
        };
        transaction.objectStore(CHUNK_STORE).put({
          clipId,
          index: current.chunkCount,
          blob,
          size: blob.size,
          createdAt: Date.now(),
        } satisfies LocalRangeExtractionChunkRecord);
        clips.put(next);
      } catch (error) {
        writeError = error;
        transaction.abort();
      }
    };
    request.onerror = () => {
      writeError = request.error ?? new Error("Could not inspect the local recording stage.");
      transaction.abort();
    };
    transaction.oncomplete = () => {
      if (!next) {
        reject(new Error("The local recording chunk was not persisted."));
        return;
      }
      resolve(next);
    };
    transaction.onerror = () =>
      reject(
        writeError ?? transaction.error ?? new Error("Could not persist the local recording."),
      );
    transaction.onabort = () =>
      reject(
        writeError ?? transaction.error ?? new Error("Local recording persistence was aborted."),
      );
  });
}

export async function finalizeLocalRangeExtractionStage(
  clipId: string,
  input: {
    durationSeconds: number;
    mimeType: string;
    wallTimeMilliseconds: number;
    mainThreadBusyMilliseconds?: number;
  },
): Promise<LocalRangeExtractionClipRecord> {
  const db = await openDatabase();
  const current = await readRecord<LocalRangeExtractionClipRecord>(db, CLIP_STORE, clipId);
  if (
    !current ||
    current.status !== "staging" ||
    current.chunkCount <= 0 ||
    current.byteSize <= 0
  ) {
    throw new Error("The local recording stage is incomplete and cannot be promoted.");
  }
  const next: LocalRangeExtractionClipRecord = {
    ...current,
    status: "ready",
    durationSeconds: input.durationSeconds,
    mimeType: input.mimeType,
    wallTimeMilliseconds: input.wallTimeMilliseconds,
    mainThreadBusyMilliseconds: input.mainThreadBusyMilliseconds,
    updatedAt: Date.now(),
  };
  await writeRecord(db, CLIP_STORE, next);
  return next;
}

export async function getLocalRangeExtractionClip(
  clipId: string,
): Promise<LocalRangeExtractionClipRecord | undefined> {
  const db = await openDatabase();
  return readRecord<LocalRangeExtractionClipRecord>(db, CLIP_STORE, clipId);
}

export async function listReadyLocalRangeExtractionClips(input: {
  materialId: string;
  sourceUploadId: string;
}): Promise<LocalRangeExtractionClipRecord[]> {
  const db = await openDatabase();
  const records = await readAll<LocalRangeExtractionClipRecord>(db, CLIP_STORE);
  return records.filter(
    (record) =>
      record.status === "ready" &&
      record.materialId === input.materialId &&
      record.sourceUploadId === input.sourceUploadId,
  );
}

export async function listLocalRangeExtractionClips(): Promise<LocalRangeExtractionClipRecord[]> {
  const db = await openDatabase();
  return readAll<LocalRangeExtractionClipRecord>(db, CLIP_STORE);
}

export async function getLocalRangeExtractionBlob(
  clipId: string,
  options: { includeStaging?: boolean } = {},
): Promise<Blob | undefined> {
  const record = await getLocalRangeExtractionClip(clipId);
  if (!record || (record.status !== "ready" && !options.includeStaging)) return undefined;
  const db = await openDatabase();
  const chunks = await readChunksForClip(db, clipId);
  chunks.sort((left, right) => left.index - right.index);
  if (chunks.length !== record.chunkCount) {
    throw new Error("The persisted local recording is incomplete.");
  }
  const byteSize = chunks.reduce((sum, chunk) => sum + chunk.size, 0);
  if (byteSize !== record.byteSize) {
    throw new Error("The persisted local recording size does not match its manifest.");
  }
  return new Blob(
    chunks.map((chunk) => chunk.blob),
    { type: record.mimeType },
  );
}

export async function getLocalRangeExtractionFile(clipId: string): Promise<File | undefined> {
  const record = await getLocalRangeExtractionClip(clipId);
  const blob = await getLocalRangeExtractionBlob(clipId);
  if (!record || !blob) return undefined;
  return new File([blob], record.fileName, {
    type: record.mimeType,
    lastModified: record.updatedAt,
  });
}

export function localRangeExtractionProvenance(
  record: LocalRangeExtractionClipRecord,
): LocalRangeExtractionProvenance {
  if (
    record.status !== "ready" ||
    !record.durationSeconds ||
    record.wallTimeMilliseconds === undefined
  ) {
    throw new Error("Only a completed local recording can be attached to a range.");
  }
  return {
    materialId: record.materialId,
    sourceUploadId: record.sourceUploadId,
    rangeId: record.rangeId,
    startSeconds: record.startSeconds,
    endSeconds: record.endSeconds,
    clipId: record.id,
    fileName: record.fileName,
    mimeType: record.mimeType,
    byteSize: record.byteSize,
    durationSeconds: record.durationSeconds,
    estimatedBytes: record.estimatedBytes,
    wallTimeMilliseconds: record.wallTimeMilliseconds,
    mainThreadBusyMilliseconds: record.mainThreadBusyMilliseconds,
    createdAt: record.updatedAt,
  };
}

export async function deleteLocalRangeExtractionClip(clipId: string): Promise<void> {
  const db = await openDatabase();
  await Promise.all([deleteRecord(db, CLIP_STORE, clipId), deleteChunksForClip(db, clipId)]);
}

export async function deleteLocalRangeExtractionClipsForMaterial(
  materialId: string,
): Promise<void> {
  const db = await openDatabase();
  const records = await readAll<LocalRangeExtractionClipRecord>(db, CLIP_STORE);
  for (const record of records.filter((item) => item.materialId === materialId)) {
    await Promise.all([
      deleteRecord(db, CLIP_STORE, record.id),
      deleteChunksForClip(db, record.id),
    ]);
  }
}

export async function clearLocalRangeExtractionClips(): Promise<void> {
  const db = await openDatabase();
  await Promise.all([clearStore(db, CLIP_STORE), clearStore(db, CHUNK_STORE)]);
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is unavailable for local range extraction."));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CLIP_STORE)) {
        db.createObjectStore(CLIP_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(CHUNK_STORE)) {
        const chunks = db.createObjectStore(CHUNK_STORE, { keyPath: ["clipId", "index"] });
        chunks.createIndex(CHUNKS_BY_CLIP, "clipId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not open local range extraction storage."));
    request.onblocked = () =>
      reject(new Error("Local range extraction storage is blocked by another tab."));
  });
}

function writeRecord(db: IDBDatabase, storeName: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(value);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Could not persist local range extraction data."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Local range extraction persistence was aborted."));
  });
}

function readRecord<T>(
  db: IDBDatabase,
  storeName: string,
  key: IDBValidKey,
): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not read local range extraction data."));
  });
}

function readAll<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not list local range extraction data."));
  });
}

function readChunksForClip(
  db: IDBDatabase,
  clipId: string,
): Promise<LocalRangeExtractionChunkRecord[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CHUNK_STORE, "readonly");
    const request = transaction.objectStore(CHUNK_STORE).index(CHUNKS_BY_CLIP).getAll(clipId);
    request.onsuccess = () => resolve(request.result as LocalRangeExtractionChunkRecord[]);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not read local recording chunks."));
  });
}

function deleteRecord(db: IDBDatabase, storeName: string, key: IDBValidKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).delete(key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Could not delete local range extraction data."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Local range extraction deletion was aborted."));
  });
}

function deleteChunksForClip(db: IDBDatabase, clipId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CHUNK_STORE, "readwrite");
    const index = transaction.objectStore(CHUNK_STORE).index(CHUNKS_BY_CLIP);
    const request = index.openKeyCursor(IDBKeyRange.only(clipId));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      transaction.objectStore(CHUNK_STORE).delete(cursor.primaryKey);
      cursor.continue();
    };
    request.onerror = () =>
      reject(request.error ?? new Error("Could not inspect local recording chunks."));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Could not delete local recording chunks."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Local recording deletion was aborted."));
  });
}

function clearStore(db: IDBDatabase, storeName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Could not clear local range extraction data."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Local range extraction cleanup was aborted."));
  });
}
