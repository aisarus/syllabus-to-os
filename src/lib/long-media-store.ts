import {
  LONG_MEDIA_CHUNK_BYTES,
  type LongMediaChunkRecord,
  type LongMediaManifest,
  type LongMediaTranscriptDraft,
  validateLongMediaFile,
} from "./long-media";

const DATABASE_NAME = "lamdan-long-media";
const DATABASE_VERSION = 1;
const MANIFEST_STORE = "manifests";
const CHUNK_STORE = "chunks";
const TRANSCRIPT_STORE = "transcripts";
const CHUNKS_BY_UPLOAD = "by-upload";
const CHUNKS_BY_MATERIAL = "by-material";

export interface LongMediaWriteProgress {
  writtenBytes: number;
  totalBytes: number;
  completedChunks: number;
  totalChunks: number;
}

export interface LongMediaStorageStats {
  mediaCount: number;
  transcriptCount: number;
  totalBytes: number;
}

function uid(prefix: string): string {
  return `${prefix}_${crypto.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
}

function bytesToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (value) => value.toString(16).padStart(2, "0")).join(
    "",
  );
}

async function sha256(blob: Blob): Promise<string> {
  if (!crypto.subtle) return `size-${blob.size}`;
  return bytesToHex(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()));
}

async function requestDurableStorage(): Promise<void> {
  try {
    await navigator.storage?.persist?.();
  } catch {
    // Persistence is a best-effort browser capability; upload may still continue.
  }
}

async function assertStorageCapacity(requiredBytes: number): Promise<void> {
  try {
    const estimate = await navigator.storage?.estimate?.();
    if (!estimate?.quota) return;
    const remaining = estimate.quota - (estimate.usage ?? 0);
    const safetyMargin = Math.max(32 * 1024 * 1024, Math.ceil(requiredBytes * 0.08));
    if (remaining < requiredBytes + safetyMargin) {
      throw new Error(
        `Not enough local browser storage. Need about ${Math.ceil((requiredBytes + safetyMargin) / 1024 / 1024)} MB free.`,
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Not enough")) throw error;
  }
}

export async function putLongMediaFile(
  materialId: string,
  file: File,
  options: {
    signal?: AbortSignal;
    onProgress?: (progress: LongMediaWriteProgress) => void;
  } = {},
): Promise<LongMediaManifest> {
  const validation = validateLongMediaFile(file);
  if (!validation.ok || !validation.kind) {
    throw new Error(validation.message ?? "Unsupported lecture media file.");
  }
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is unavailable, so a long lecture cannot be stored safely.");
  }

  await requestDurableStorage();
  await assertStorageCapacity(file.size);

  const db = await openDatabase();
  const existing = await getLongMediaManifest(materialId);
  const uploadId = uid("media");
  const totalChunks = Math.ceil(file.size / LONG_MEDIA_CHUNK_BYTES);
  let writtenBytes = 0;

  try {
    for (let index = 0; index < totalChunks; index += 1) {
      if (options.signal?.aborted) throw new DOMException("Upload cancelled.", "AbortError");
      const start = index * LONG_MEDIA_CHUNK_BYTES;
      const end = Math.min(file.size, start + LONG_MEDIA_CHUNK_BYTES);
      const blob = file.slice(start, end, file.type || "application/octet-stream");
      const record: LongMediaChunkRecord = {
        uploadId,
        materialId,
        index,
        size: blob.size,
        sha256: await sha256(blob),
        blob,
        createdAt: Date.now(),
      };
      await writeRecord(db, CHUNK_STORE, record);
      writtenBytes += blob.size;
      options.onProgress?.({
        writtenBytes,
        totalBytes: file.size,
        completedChunks: index + 1,
        totalChunks,
      });
    }

    const now = Date.now();
    const manifest: LongMediaManifest = {
      materialId,
      uploadId,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      kind: validation.kind,
      size: file.size,
      chunkSize: LONG_MEDIA_CHUNK_BYTES,
      chunkCount: totalChunks,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await writeRecord(db, MANIFEST_STORE, manifest);
    await deleteRecord(db, TRANSCRIPT_STORE, materialId);
    if (existing && existing.uploadId !== uploadId) {
      await deleteChunksForUpload(db, existing.uploadId);
    }
    return manifest;
  } catch (error) {
    await deleteChunksForUpload(db, uploadId).catch(() => undefined);
    throw error;
  }
}

export async function getLongMediaManifest(
  materialId: string,
): Promise<LongMediaManifest | undefined> {
  const db = await openDatabase();
  return readRecord<LongMediaManifest>(db, MANIFEST_STORE, materialId);
}

export async function listLongMediaManifests(): Promise<LongMediaManifest[]> {
  const db = await openDatabase();
  return readAll<LongMediaManifest>(db, MANIFEST_STORE);
}

export async function updateLongMediaDuration(
  materialId: string,
  durationSeconds: number,
): Promise<LongMediaManifest | undefined> {
  const manifest = await getLongMediaManifest(materialId);
  if (!manifest || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return manifest;
  const updated = { ...manifest, durationSeconds, updatedAt: Date.now() };
  const db = await openDatabase();
  await writeRecord(db, MANIFEST_STORE, updated);
  return updated;
}

export async function getLongMediaBlob(materialId: string): Promise<Blob | undefined> {
  const manifest = await getLongMediaManifest(materialId);
  if (!manifest) return undefined;
  const db = await openDatabase();
  const chunks = await readChunksForUpload(db, manifest.uploadId);
  chunks.sort((a, b) => a.index - b.index);
  if (chunks.length !== manifest.chunkCount) {
    throw new Error("The locally stored lecture is incomplete. Re-upload the original file.");
  }
  const total = chunks.reduce((sum, chunk) => sum + chunk.size, 0);
  if (total !== manifest.size) {
    throw new Error("The locally stored lecture size does not match its manifest.");
  }
  return new Blob(
    chunks.map((chunk) => chunk.blob),
    { type: manifest.mimeType },
  );
}

export async function verifyLongMediaIntegrity(materialId: string): Promise<boolean> {
  const manifest = await getLongMediaManifest(materialId);
  if (!manifest) return false;
  const db = await openDatabase();
  const chunks = await readChunksForUpload(db, manifest.uploadId);
  if (chunks.length !== manifest.chunkCount) return false;
  chunks.sort((a, b) => a.index - b.index);
  for (const chunk of chunks) {
    if ((await sha256(chunk.blob)) !== chunk.sha256) return false;
  }
  return chunks.reduce((sum, chunk) => sum + chunk.size, 0) === manifest.size;
}

export async function getLongMediaTranscript(
  materialId: string,
): Promise<LongMediaTranscriptDraft | undefined> {
  const db = await openDatabase();
  return readRecord<LongMediaTranscriptDraft>(db, TRANSCRIPT_STORE, materialId);
}

export async function putLongMediaTranscript(
  draft: LongMediaTranscriptDraft,
): Promise<LongMediaTranscriptDraft> {
  const manifest = await getLongMediaManifest(draft.materialId);
  if (!manifest || manifest.uploadId !== draft.sourceUploadId) {
    throw new Error("This transcript belongs to an older lecture upload.");
  }
  const normalized: LongMediaTranscriptDraft = {
    ...draft,
    segments: draft.segments
      .filter(
        (segment) =>
          Number.isFinite(segment.startSeconds) &&
          Number.isFinite(segment.endSeconds) &&
          segment.startSeconds >= 0 &&
          segment.endSeconds > segment.startSeconds,
      )
      .sort((a, b) => a.startSeconds - b.startSeconds),
    updatedAt: Date.now(),
  };
  const db = await openDatabase();
  await writeRecord(db, TRANSCRIPT_STORE, normalized);
  return normalized;
}

export async function deleteLongMediaData(materialId: string): Promise<void> {
  const db = await openDatabase();
  const manifest = await readRecord<LongMediaManifest>(db, MANIFEST_STORE, materialId);
  if (manifest) await deleteChunksForUpload(db, manifest.uploadId);
  await Promise.all([
    deleteRecord(db, MANIFEST_STORE, materialId),
    deleteRecord(db, TRANSCRIPT_STORE, materialId),
  ]);
}

export async function clearAllLongMediaData(): Promise<void> {
  const db = await openDatabase();
  await Promise.all([
    clearStore(db, MANIFEST_STORE),
    clearStore(db, CHUNK_STORE),
    clearStore(db, TRANSCRIPT_STORE),
  ]);
}

export async function pruneLongMediaData(validMaterialIds: Iterable<string>): Promise<number> {
  const valid = new Set(validMaterialIds);
  const manifests = await listLongMediaManifests();
  const orphanIds = manifests
    .filter((item) => !valid.has(item.materialId))
    .map((item) => item.materialId);
  for (const materialId of orphanIds) await deleteLongMediaData(materialId);
  return orphanIds.length;
}

export async function getLongMediaStorageStats(): Promise<LongMediaStorageStats> {
  const db = await openDatabase();
  const [manifests, transcripts] = await Promise.all([
    readAll<LongMediaManifest>(db, MANIFEST_STORE),
    readAll<LongMediaTranscriptDraft>(db, TRANSCRIPT_STORE),
  ]);
  return {
    mediaCount: manifests.length,
    transcriptCount: transcripts.length,
    totalBytes: manifests.reduce((sum, item) => sum + item.size, 0),
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
      if (!db.objectStoreNames.contains(MANIFEST_STORE)) {
        db.createObjectStore(MANIFEST_STORE, { keyPath: "materialId" });
      }
      if (!db.objectStoreNames.contains(CHUNK_STORE)) {
        const store = db.createObjectStore(CHUNK_STORE, { keyPath: ["uploadId", "index"] });
        store.createIndex(CHUNKS_BY_UPLOAD, "uploadId", { unique: false });
        store.createIndex(CHUNKS_BY_MATERIAL, "materialId", { unique: false });
      }
      if (!db.objectStoreNames.contains(TRANSCRIPT_STORE)) {
        db.createObjectStore(TRANSCRIPT_STORE, { keyPath: "materialId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not open lecture-media storage."));
    request.onblocked = () => reject(new Error("Lecture-media storage is blocked by another tab."));
  });
}

function writeRecord(db: IDBDatabase, storeName: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(value);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Could not save lecture media."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Lecture-media save was aborted."));
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
    request.onerror = () => reject(request.error ?? new Error("Could not read lecture media."));
  });
}

function readAll<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not inspect lecture-media storage."));
  });
}

function readChunksForUpload(db: IDBDatabase, uploadId: string): Promise<LongMediaChunkRecord[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CHUNK_STORE, "readonly");
    const request = transaction.objectStore(CHUNK_STORE).index(CHUNKS_BY_UPLOAD).getAll(uploadId);
    request.onsuccess = () => resolve(request.result as LongMediaChunkRecord[]);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not read lecture-media chunks."));
  });
}

function deleteChunksForUpload(db: IDBDatabase, uploadId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CHUNK_STORE, "readwrite");
    const index = transaction.objectStore(CHUNK_STORE).index(CHUNKS_BY_UPLOAD);
    const request = index.openKeyCursor(IDBKeyRange.only(uploadId));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      transaction.objectStore(CHUNK_STORE).delete(cursor.primaryKey);
      cursor.continue();
    };
    request.onerror = () =>
      reject(request.error ?? new Error("Could not inspect lecture-media chunks."));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Could not delete lecture-media chunks."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Lecture-media deletion was aborted."));
  });
}

function deleteRecord(db: IDBDatabase, storeName: string, key: IDBValidKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).delete(key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Could not delete lecture-media data."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Lecture-media deletion was aborted."));
  });
}

function clearStore(db: IDBDatabase, storeName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Could not clear lecture-media data."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Lecture-media clearing was aborted."));
  });
}
