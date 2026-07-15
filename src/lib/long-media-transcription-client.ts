import type { LongMediaChunkRecord, LongMediaManifest } from "./long-media";
import type {
  ProviderTranscriptionRangeResult,
  LongMediaTranscriptionRange,
} from "./long-media-transcription";

const CONSENT_HEADER = "google-gemini-files-v1";
const DATABASE_NAME = "lamdan-long-media";
const DATABASE_VERSION = 1;
const CHUNK_STORE = "chunks";
const CHUNKS_BY_UPLOAD = "by-upload";

export interface TranscriptionProviderStatus {
  configured: boolean;
  provider: "google-gemini-files";
  providerName: string;
  model: string;
  maxFileBytes: number;
  retentionHours: number;
  supportsResumableUpload: true;
  sendsRecordingExternally: true;
}

export interface ProviderUploadedFile {
  name: string;
  uri: string;
  mimeType: string;
  sizeBytes?: number;
  state?: string;
}

export interface UploadProgress {
  uploadedBytes: number;
  totalBytes: number;
  completedChunks: number;
  totalChunks: number;
}

export async function getTranscriptionProviderStatus(
  signal?: AbortSignal,
): Promise<TranscriptionProviderStatus> {
  const response = await fetch("/api/ai/transcription", { signal });
  const payload = await readResult<TranscriptionProviderStatus>(response);
  return payload;
}

export async function uploadStoredLectureToProvider(
  manifest: LongMediaManifest,
  options: {
    signal?: AbortSignal;
    onProgress?: (progress: UploadProgress) => void;
  } = {},
): Promise<ProviderUploadedFile> {
  const chunks = await readStoredChunks(manifest);
  const session = await postJSON<{ uploadUrl: string }>("start", {
    fileName: manifest.fileName,
    mimeType: manifest.mimeType,
    size: manifest.size,
  }, options.signal);
  let offset = 0;
  let file: ProviderUploadedFile | undefined;
  for (let index = 0; index < chunks.length; index += 1) {
    throwIfAborted(options.signal);
    const chunk = chunks[index];
    const last = index === chunks.length - 1;
    const response = await fetch("/api/ai/transcription?action=chunk", {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "x-lamdan-external-upload-consent": CONSENT_HEADER,
        "x-lamdan-upload-url": session.uploadUrl,
        "x-lamdan-upload-offset": String(offset),
        "x-lamdan-upload-command": last ? "upload, finalize" : "upload",
      },
      body: chunk.blob,
      signal: options.signal,
    });
    const result = await readResult<{ nextOffset: number; file?: ProviderUploadedFile }>(response);
    offset = result.nextOffset;
    file = result.file ?? file;
    options.onProgress?.({
      uploadedBytes: offset,
      totalBytes: manifest.size,
      completedChunks: index + 1,
      totalChunks: chunks.length,
    });
  }
  if (!file) throw new Error("Provider upload finished without a usable file reference.");
  return file;
}

export async function transcribeStoredLectureRange(input: {
  jobId: string;
  range: LongMediaTranscriptionRange;
  providerFileName: string;
  providerFileUri: string;
  mimeType: string;
  languageHint?: string;
  signal?: AbortSignal;
}): Promise<ProviderTranscriptionRangeResult> {
  return postJSON<ProviderTranscriptionRangeResult>(
    "range",
    {
      jobId: input.jobId,
      rangeId: input.range.id,
      providerFileName: input.providerFileName,
      providerFileUri: input.providerFileUri,
      mimeType: input.mimeType,
      startSeconds: input.range.startSeconds,
      endSeconds: input.range.endSeconds,
      languageHint: input.languageHint,
    },
    input.signal,
  );
}

export async function deleteProviderTranscriptionFile(
  fileName: string,
  signal?: AbortSignal,
): Promise<void> {
  await postJSON<{ deleted: true }>("delete", { fileName }, signal, false);
}

async function postJSON<T>(
  action: string,
  body: unknown,
  signal?: AbortSignal,
  consent = true,
): Promise<T> {
  const response = await fetch(`/api/ai/transcription?action=${encodeURIComponent(action)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(consent ? { "x-lamdan-external-upload-consent": CONSENT_HEADER } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });
  return readResult<T>(response);
}

async function readResult<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; data?: T; error?: string; details?: string }
    | null;
  if (!response.ok || !payload?.ok || payload.data === undefined) {
    throw new Error(payload?.details || payload?.error || `Transcription request failed (${response.status}).`);
  }
  return payload.data;
}

async function readStoredChunks(manifest: LongMediaManifest): Promise<LongMediaChunkRecord[]> {
  const db = await openDatabase();
  try {
    const chunks = await new Promise<LongMediaChunkRecord[]>((resolve, reject) => {
      const transaction = db.transaction(CHUNK_STORE, "readonly");
      const request = transaction.objectStore(CHUNK_STORE).index(CHUNKS_BY_UPLOAD).getAll(manifest.uploadId);
      request.onsuccess = () => resolve(request.result as LongMediaChunkRecord[]);
      request.onerror = () => reject(request.error ?? new Error("Could not read stored lecture chunks."));
    });
    chunks.sort((left, right) => left.index - right.index);
    if (chunks.length !== manifest.chunkCount) {
      throw new Error("The local recording is incomplete and cannot be sent for transcription.");
    }
    const total = chunks.reduce((sum, chunk) => sum + chunk.size, 0);
    if (total !== manifest.size) {
      throw new Error("The local recording size no longer matches its manifest.");
    }
    return chunks;
  } finally {
    db.close();
  }
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is unavailable in this browser."));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open lecture-media storage."));
    request.onblocked = () => reject(new Error("Lecture-media storage is blocked by another tab."));
  });
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Transcription stopped.", "AbortError");
}
