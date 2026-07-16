import type { LongMediaChunkRecord, LongMediaManifest } from "./long-media";
import {
  extractLocalAudioRange as extractRealtimeLocalAudioRange,
  estimateLocalRangeExtraction,
  type LocalRangeExtractionOptions,
  type LocalRangeExtractionProgress,
  type LocalRangeExtractionResult,
} from "./local-range-extraction";
import { ensureLongMediaStreamWorker } from "./long-media-streaming";

export {
  estimateLocalRangeExtraction,
  type LocalRangeExtractionOptions,
  type LocalRangeExtractionProgress,
  type LocalRangeExtractionResult,
};

const WAV_HEADER_PROBE_BYTES = 64 * 1024;
const LONG_MEDIA_DB_NAME = "lamdan-long-media";
const LONG_MEDIA_DB_VERSION = 1;
const LONG_MEDIA_CHUNK_STORE = "chunks";

interface PcmWavHeader {
  channels: number;
  sampleRate: number;
  byteRate: number;
  blockAlign: number;
  bitsPerSample: number;
  dataOffset: number;
  dataSize: number;
}

export async function extractLocalAudioRange(
  manifest: LongMediaManifest,
  startSeconds: number,
  endSeconds: number,
  options: LocalRangeExtractionOptions = {},
): Promise<LocalRangeExtractionResult> {
  if (looksLikeWav(manifest)) {
    const direct = await tryExtractPcmWavRange(manifest, startSeconds, endSeconds, options);
    if (direct) return direct;
  }
  return extractRealtimeLocalAudioRange(manifest, startSeconds, endSeconds, options);
}

export function parsePcmWavHeader(bytes: Uint8Array): PcmWavHeader | null {
  if (bytes.byteLength < 44) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (readAscii(bytes, 0, 4) !== "RIFF" || readAscii(bytes, 8, 4) !== "WAVE") return null;

  let channels = 0;
  let sampleRate = 0;
  let byteRate = 0;
  let blockAlign = 0;
  let bitsPerSample = 0;
  let pcmFormat = 0;
  let dataOffset = -1;
  let dataSize = 0;
  let offset = 12;

  while (offset + 8 <= bytes.byteLength) {
    const chunkId = readAscii(bytes, offset, 4);
    const chunkSize = view.getUint32(offset + 4, true);
    const payloadOffset = offset + 8;
    if (chunkId === "fmt " && chunkSize >= 16 && payloadOffset + 16 <= bytes.byteLength) {
      pcmFormat = view.getUint16(payloadOffset, true);
      channels = view.getUint16(payloadOffset + 2, true);
      sampleRate = view.getUint32(payloadOffset + 4, true);
      byteRate = view.getUint32(payloadOffset + 8, true);
      blockAlign = view.getUint16(payloadOffset + 12, true);
      bitsPerSample = view.getUint16(payloadOffset + 14, true);
    } else if (chunkId === "data") {
      dataOffset = payloadOffset;
      dataSize = chunkSize;
      break;
    }
    offset = payloadOffset + chunkSize + (chunkSize % 2);
  }

  if (
    pcmFormat !== 1 ||
    channels <= 0 ||
    sampleRate <= 0 ||
    byteRate <= 0 ||
    blockAlign <= 0 ||
    bitsPerSample <= 0 ||
    dataOffset < 0 ||
    dataSize <= 0
  ) {
    return null;
  }

  return {
    channels,
    sampleRate,
    byteRate,
    blockAlign,
    bitsPerSample,
    dataOffset,
    dataSize,
  };
}

async function tryExtractPcmWavRange(
  manifest: LongMediaManifest,
  startSeconds: number,
  endSeconds: number,
  options: LocalRangeExtractionOptions,
): Promise<LocalRangeExtractionResult | null> {
  if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds) || startSeconds < 0) {
    throw new Error("The extraction range is invalid.");
  }
  if (endSeconds <= startSeconds) {
    throw new Error("The extraction range must have a positive duration.");
  }
  if (manifest.durationSeconds && endSeconds > manifest.durationSeconds + 0.05) {
    throw new Error("The extraction range extends beyond the current lecture duration.");
  }
  throwIfAborted(options.signal);
  options.onProgress?.({
    phase: "preparing",
    capturedSeconds: 0,
    totalSeconds: endSeconds - startSeconds,
    fraction: 0,
  });

  await ensureLongMediaStreamWorker();
  const probeEnd = Math.min(manifest.size, WAV_HEADER_PROBE_BYTES);
  const headerBytes = await readStoredMediaRange(manifest, 0, probeEnd, options.signal);
  const header = parsePcmWavHeader(headerBytes);
  if (!header) return null;

  const availableFrames = Math.floor(header.dataSize / header.blockAlign);
  const startFrame = Math.max(0, Math.floor(startSeconds * header.sampleRate));
  const endFrame = Math.min(availableFrames, Math.ceil(endSeconds * header.sampleRate));
  if (endFrame <= startFrame) throw new Error("The requested WAV range contains no PCM frames.");

  const firstByte = header.dataOffset + startFrame * header.blockAlign;
  const lastByteExclusive = header.dataOffset + endFrame * header.blockAlign;
  options.onProgress?.({
    phase: "seeking",
    capturedSeconds: 0,
    totalSeconds: endSeconds - startSeconds,
    fraction: 0,
  });
  const pcmBytes = await readStoredMediaRange(
    manifest,
    firstByte,
    lastByteExclusive,
    options.signal,
  );
  const expectedBytes = lastByteExclusive - firstByte;
  if (pcmBytes.byteLength !== expectedBytes) {
    throw new Error(
      `The exact WAV range returned ${pcmBytes.byteLength} bytes instead of ${expectedBytes}.`,
    );
  }
  throwIfAborted(options.signal);

  const outputHeader = buildPcmWavHeader(header, pcmBytes.byteLength);
  const blob = new Blob([toArrayBuffer(outputHeader), toArrayBuffer(pcmBytes)], {
    type: "audio/wav",
  });
  const capturedDurationSeconds = (endFrame - startFrame) / header.sampleRate;
  options.onProgress?.({
    phase: "finalizing",
    capturedSeconds: capturedDurationSeconds,
    totalSeconds: endSeconds - startSeconds,
    fraction: 1,
  });
  const file = new File(
    [blob],
    `${sanitizeBaseName(manifest.fileName)}-${formatRangePart(startSeconds)}-${formatRangePart(endSeconds)}.wav`,
    { type: "audio/wav", lastModified: Date.now() },
  );
  return {
    file,
    blob,
    mimeType: "audio/wav",
    startSeconds,
    endSeconds,
    expectedDurationSeconds: endSeconds - startSeconds,
    capturedDurationSeconds,
    measuredBlobDurationSeconds: capturedDurationSeconds,
    sourceUploadId: manifest.uploadId,
  };
}

async function readStoredMediaRange(
  manifest: LongMediaManifest,
  startByte: number,
  endByteExclusive: number,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  if (
    !Number.isInteger(startByte) ||
    !Number.isInteger(endByteExclusive) ||
    startByte < 0 ||
    endByteExclusive <= startByte ||
    endByteExclusive > manifest.size
  ) {
    throw new Error("The requested local media byte range is invalid.");
  }
  throwIfAborted(signal);
  const db = await openExistingLongMediaDatabase();
  try {
    const result = new Uint8Array(endByteExclusive - startByte);
    const firstChunkIndex = Math.floor(startByte / manifest.chunkSize);
    const lastChunkIndex = Math.floor((endByteExclusive - 1) / manifest.chunkSize);
    let writeOffset = 0;

    for (let index = firstChunkIndex; index <= lastChunkIndex; index += 1) {
      throwIfAborted(signal);
      const chunk = await readChunk(db, manifest.uploadId, index);
      if (!chunk || chunk.materialId !== manifest.materialId) {
        throw new Error(`Stored lecture chunk ${index} is missing or belongs to another material.`);
      }
      const chunkStartByte = index * manifest.chunkSize;
      const localStart = Math.max(0, startByte - chunkStartByte);
      const localEnd = Math.min(chunk.blob.size, endByteExclusive - chunkStartByte);
      if (localEnd <= localStart) continue;
      const bytes = new Uint8Array(await chunk.blob.slice(localStart, localEnd).arrayBuffer());
      result.set(bytes, writeOffset);
      writeOffset += bytes.byteLength;
    }

    if (writeOffset !== result.byteLength) {
      throw new Error(
        `Stored lecture chunks produced ${writeOffset} bytes instead of ${result.byteLength}.`,
      );
    }
    return result;
  } finally {
    db.close();
  }
}

function openExistingLongMediaDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LONG_MEDIA_DB_NAME, LONG_MEDIA_DB_VERSION);
    request.onupgradeneeded = () => {
      request.transaction?.abort();
    };
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(LONG_MEDIA_CHUNK_STORE)) {
        db.close();
        reject(new Error("The stored lecture chunk database is unavailable."));
        return;
      }
      resolve(db);
    };
    request.onerror = () =>
      reject(request.error ?? new Error("Could not open stored lecture chunks."));
    request.onblocked = () =>
      reject(new Error("Stored lecture chunks are blocked by another tab."));
  });
}

function readChunk(
  db: IDBDatabase,
  uploadId: string,
  index: number,
): Promise<LongMediaChunkRecord | undefined> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(LONG_MEDIA_CHUNK_STORE, "readonly");
    const request = transaction.objectStore(LONG_MEDIA_CHUNK_STORE).get([uploadId, index]);
    request.onsuccess = () => resolve(request.result as LongMediaChunkRecord | undefined);
    request.onerror = () =>
      reject(request.error ?? new Error(`Could not read lecture chunk ${index}.`));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error(`Lecture chunk ${index} read aborted.`));
  });
}

function buildPcmWavHeader(source: PcmWavHeader, dataSize: number): Uint8Array {
  const buffer = new ArrayBuffer(44);
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  writeAscii(bytes, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(bytes, 8, "WAVE");
  writeAscii(bytes, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, source.channels, true);
  view.setUint32(24, source.sampleRate, true);
  view.setUint32(28, source.byteRate, true);
  view.setUint16(32, source.blockAlign, true);
  view.setUint16(34, source.bitsPerSample, true);
  writeAscii(bytes, 36, "data");
  view.setUint32(40, dataSize, true);
  return bytes;
}

function looksLikeWav(manifest: LongMediaManifest): boolean {
  const mimeType = manifest.mimeType.toLowerCase();
  return (
    mimeType === "audio/wav" ||
    mimeType === "audio/wave" ||
    mimeType === "audio/x-wav" ||
    manifest.fileName.toLowerCase().endsWith(".wav")
  );
}

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
  let value = "";
  for (let index = 0; index < length; index += 1) {
    value += String.fromCharCode(bytes[offset + index] ?? 0);
  }
  return value;
}

function writeAscii(bytes: Uint8Array, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    bytes[offset + index] = value.charCodeAt(index);
  }
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Local range extraction cancelled.", "AbortError");
}

function sanitizeBaseName(fileName: string): string {
  return (
    fileName
      .replace(/\.[^.]+$/, "")
      .replace(/[^\p{L}\p{N}._-]+/gu, "-")
      .replace(/^-+|-+$/g, "") || "lecture"
  );
}

function formatRangePart(seconds: number): string {
  return String(Math.max(0, Math.round(seconds))).padStart(5, "0");
}
