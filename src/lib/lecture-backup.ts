import type { AutomaticTranscriptionJob } from "./automatic-transcription";
import { getAutomaticTranscriptionJob } from "./automatic-transcription-store";
import type {
  LongMediaChunkRecord,
  LongMediaManifest,
  LongMediaTranscriptDraft,
} from "./long-media";
import {
  getLongMediaChunkRecord,
  getLongMediaManifest,
  getLongMediaTranscript,
} from "./long-media-store";
import type { ResumableTranscriptionJob } from "./resumable-transcription";
import {
  getResumableRangeClip,
  getResumableTranscriptionJob,
  type ResumableRangeClipRecord,
} from "./resumable-transcription-store";
import { getDataSnapshot, type Material } from "./store";

export const LECTURE_BACKUP_FORMAT = "lamdan-lecture-backup";
export const LECTURE_BACKUP_VERSION = 1;
export const LECTURE_BACKUP_EXTENSION = ".lamdan-lecture";
export const LECTURE_BACKUP_MIME_TYPE = "application/x-lamdan-lecture-backup";
export const LECTURE_BACKUP_MAGIC = "LAM_DAN_LECTURE_BACKUP_V1\n";
export const MAX_LECTURE_BACKUP_HEADER_BYTES = 1024 * 1024;

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const FRAME_PREFIX_BYTES = 4;

export type LectureBackupRecordKind =
  | "coreMaterial"
  | "longMediaManifest"
  | "mediaChunk"
  | "transcriptDraft"
  | "automaticTranscriptionJob"
  | "resumableTranscriptionJob"
  | "rangeClip";

export interface LectureBackupRecordDescriptor {
  id: string;
  kind: LectureBackupRecordKind;
  size: number;
  sha256: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface LectureBackupManifest {
  format: typeof LECTURE_BACKUP_FORMAT;
  version: typeof LECTURE_BACKUP_VERSION;
  createdAt: string;
  materialId: string;
  sourceUploadId: string;
  sourceFileName: string;
  sourceMimeType: string;
  durationSeconds?: number;
  rawMediaBytes: number;
  payloadBytes: number;
  records: LectureBackupRecordDescriptor[];
}

export interface LectureBackupPlan {
  manifest: LectureBackupManifest;
  estimatedFileBytes: number;
  mediaChunkCount: number;
  localClipCount: number;
  includesTranscriptDraft: boolean;
  includesAutomaticCandidate: boolean;
  includesResumableQueue: boolean;
}

export interface LectureBackupProgress {
  phase: "planning" | "writing" | "verifying";
  completedRecords: number;
  totalRecords: number;
  processedBytes: number;
  totalBytes: number;
  currentKind?: LectureBackupRecordKind | "bundleManifest";
}

export interface LectureBackupInspection {
  manifest: LectureBackupManifest;
  verifiedRecords: number;
  bytes: number;
}

interface WritableFileLike {
  write(data: Blob | BufferSource | string): Promise<void>;
  close(): Promise<void>;
  abort?(reason?: unknown): Promise<void>;
}

interface SaveFileHandleLike {
  createWritable(): Promise<WritableFileLike>;
}

interface SavePickerWindow extends Window {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: Array<{
      description: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<SaveFileHandleLike>;
}

interface RecordHeader extends LectureBackupRecordDescriptor {
  format: typeof LECTURE_BACKUP_FORMAT;
  version: typeof LECTURE_BACKUP_VERSION;
}

interface PreparedPayload {
  descriptor: LectureBackupRecordDescriptor;
  data: Blob | Uint8Array;
}

export function getStreamingLectureBackupCapability(): {
  supported: boolean;
  reason?: "browser_only" | "save_picker_unavailable";
} {
  if (typeof window === "undefined") return { supported: false, reason: "browser_only" };
  if (!(window as SavePickerWindow).showSaveFilePicker) {
    return { supported: false, reason: "save_picker_unavailable" };
  }
  return { supported: true };
}

export async function prepareLectureBackupPlan(
  materialId: string,
  options: {
    signal?: AbortSignal;
    onProgress?: (progress: LectureBackupProgress) => void;
  } = {},
): Promise<LectureBackupPlan> {
  throwIfAborted(options.signal);
  const coreMaterial = getDataSnapshot().materials.find((item) => item.id === materialId);
  if (!coreMaterial) throw new Error("The lecture material is missing from the workspace.");
  const [mediaManifest, transcript, automaticJob, resumableJob] = await Promise.all([
    getLongMediaManifest(materialId),
    getLongMediaTranscript(materialId),
    getAutomaticTranscriptionJob(materialId),
    getResumableTranscriptionJob(materialId),
  ]);
  if (!mediaManifest)
    throw new Error("No locally stored lecture recording exists for this material.");
  assertSourceIdentity(mediaManifest, transcript, automaticJob, resumableJob);

  const possibleClipCount = resumableJob?.ranges.length ?? 0;
  const totalCandidates =
    2 +
    mediaManifest.chunkCount +
    possibleClipCount +
    Number(Boolean(transcript)) +
    Number(Boolean(automaticJob)) +
    Number(Boolean(resumableJob));
  const records: LectureBackupRecordDescriptor[] = [];
  let completedRecords = 0;
  let processedBytes = 0;
  const report = (kind?: LectureBackupRecordKind) =>
    options.onProgress?.({
      phase: "planning",
      completedRecords,
      totalRecords: totalCandidates,
      processedBytes,
      totalBytes: mediaManifest.size,
      currentKind: kind,
    });

  const addJson = async (
    id: string,
    kind: Exclude<LectureBackupRecordKind, "mediaChunk" | "rangeClip">,
    value: unknown,
    metadata?: LectureBackupRecordDescriptor["metadata"],
  ) => {
    throwIfAborted(options.signal);
    const bytes = encodeJson(value);
    records.push({ id, kind, size: bytes.byteLength, sha256: await sha256Bytes(bytes), metadata });
    completedRecords += 1;
    processedBytes += bytes.byteLength;
    report(kind);
  };

  await addJson("core-material", "coreMaterial", coreMaterial);
  await addJson("long-media-manifest", "longMediaManifest", mediaManifest);
  if (transcript) await addJson("transcript-draft", "transcriptDraft", transcript);
  if (automaticJob) {
    await addJson("automatic-transcription-job", "automaticTranscriptionJob", automaticJob);
  }
  if (resumableJob) {
    await addJson("resumable-transcription-job", "resumableTranscriptionJob", resumableJob);
  }

  for (let index = 0; index < mediaManifest.chunkCount; index += 1) {
    throwIfAborted(options.signal);
    const chunk = await requiredMediaChunk(mediaManifest, index);
    const actualHash = await sha256Blob(chunk.blob);
    if (actualHash !== chunk.sha256) {
      throw new Error(`Lecture chunk ${index + 1} failed its stored SHA-256 check.`);
    }
    records.push({
      id: `media-chunk:${index}`,
      kind: "mediaChunk",
      size: chunk.size,
      sha256: actualHash,
      metadata: {
        index,
        uploadId: mediaManifest.uploadId,
        materialId,
        mimeType: mediaManifest.mimeType,
      },
    });
    completedRecords += 1;
    processedBytes += chunk.size;
    report("mediaChunk");
  }

  let localClipCount = 0;
  for (const range of resumableJob?.ranges ?? []) {
    throwIfAborted(options.signal);
    const clip = await getResumableRangeClip(materialId, range.id);
    if (!clip) {
      completedRecords += 1;
      report("rangeClip");
      continue;
    }
    if (clip.sourceUploadId !== mediaManifest.uploadId) {
      throw new Error(`Local range clip ${range.id} belongs to an older lecture upload.`);
    }
    const actualHash = await sha256Blob(clip.blob);
    records.push({
      id: `range-clip:${range.id}`,
      kind: "rangeClip",
      size: clip.size,
      sha256: actualHash,
      metadata: clipMetadata(clip),
    });
    localClipCount += 1;
    completedRecords += 1;
    processedBytes += clip.size;
    report("rangeClip");
  }

  const payloadBytes = records.reduce((sum, record) => sum + record.size, 0);
  const manifest: LectureBackupManifest = {
    format: LECTURE_BACKUP_FORMAT,
    version: LECTURE_BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    materialId,
    sourceUploadId: mediaManifest.uploadId,
    sourceFileName: mediaManifest.fileName,
    sourceMimeType: mediaManifest.mimeType,
    durationSeconds: mediaManifest.durationSeconds,
    rawMediaBytes: mediaManifest.size,
    payloadBytes,
    records,
  };
  validateLectureBackupManifest(manifest);
  return {
    manifest,
    estimatedFileBytes: estimateLectureBackupFileBytes(manifest),
    mediaChunkCount: mediaManifest.chunkCount,
    localClipCount,
    includesTranscriptDraft: Boolean(transcript),
    includesAutomaticCandidate: Boolean(automaticJob),
    includesResumableQueue: Boolean(resumableJob),
  };
}

export async function saveLectureBackupPlan(
  plan: LectureBackupPlan,
  options: {
    suggestedName?: string;
    signal?: AbortSignal;
    onProgress?: (progress: LectureBackupProgress) => void;
  } = {},
): Promise<void> {
  const picker =
    typeof window !== "undefined" ? (window as SavePickerWindow).showSaveFilePicker : null;
  if (!picker) {
    throw new Error(
      "Streaming lecture export requires a browser with the native Save File picker.",
    );
  }
  const suggestedName =
    options.suggestedName ?? safeBackupName(plan.manifest.sourceFileName, plan.manifest.materialId);
  const handle = await picker({
    suggestedName,
    types: [
      {
        description: "Lamdan lecture backup",
        accept: { [LECTURE_BACKUP_MIME_TYPE]: [LECTURE_BACKUP_EXTENSION] },
      },
    ],
  });
  const writable = await handle.createWritable();
  await exportLectureBackupPlanToWritable(plan, writable, options);
}

export async function exportLectureBackupPlanToWritable(
  plan: LectureBackupPlan,
  writable: WritableFileLike,
  options: {
    signal?: AbortSignal;
    onProgress?: (progress: LectureBackupProgress) => void;
  } = {},
): Promise<void> {
  validateLectureBackupManifest(plan.manifest);
  const totalRecords = plan.manifest.records.length + 1;
  let completedRecords = 0;
  let processedBytes = 0;
  const report = (kind?: LectureBackupProgress["currentKind"]) =>
    options.onProgress?.({
      phase: "writing",
      completedRecords,
      totalRecords,
      processedBytes,
      totalBytes: plan.estimatedFileBytes,
      currentKind: kind,
    });

  try {
    throwIfAborted(options.signal);
    await assertCurrentUpload(plan.manifest);
    const magic = encoder.encode(LECTURE_BACKUP_MAGIC);
    await writable.write(toArrayBuffer(magic));
    processedBytes += magic.byteLength;
    report("bundleManifest");

    const manifestBytes = encodeJson(plan.manifest);
    const manifestDescriptor: LectureBackupRecordDescriptor = {
      id: "bundle-manifest",
      kind: "longMediaManifest",
      size: manifestBytes.byteLength,
      sha256: await sha256Bytes(manifestBytes),
      metadata: { bundleManifest: true },
    };
    processedBytes += await writeRecord(writable, manifestDescriptor, manifestBytes);
    completedRecords += 1;
    report("bundleManifest");

    for (const descriptor of plan.manifest.records) {
      throwIfAborted(options.signal);
      const prepared = await loadPayload(plan.manifest, descriptor);
      const actualHash =
        prepared.data instanceof Blob
          ? await sha256Blob(prepared.data)
          : await sha256Bytes(prepared.data);
      const actualSize =
        prepared.data instanceof Blob ? prepared.data.size : prepared.data.byteLength;
      if (actualHash !== descriptor.sha256 || actualSize !== descriptor.size) {
        throw new Error(
          `Lecture backup source changed for record ${descriptor.id}. Prepare it again.`,
        );
      }
      processedBytes += await writeRecord(writable, descriptor, prepared.data);
      completedRecords += 1;
      report(descriptor.kind);
    }

    await assertCurrentUpload(plan.manifest);
    await writable.close();
  } catch (error) {
    await writable.abort?.(error).catch(() => undefined);
    throw error;
  }
}

export async function inspectLectureBackupBlob(
  blob: Blob,
  options: {
    signal?: AbortSignal;
    onProgress?: (progress: LectureBackupProgress) => void;
  } = {},
): Promise<LectureBackupInspection> {
  throwIfAborted(options.signal);
  const magicBytes = encoder.encode(LECTURE_BACKUP_MAGIC);
  if (blob.size < magicBytes.byteLength + FRAME_PREFIX_BYTES) {
    throw new Error("The lecture backup is truncated.");
  }
  const actualMagic = new Uint8Array(await blob.slice(0, magicBytes.byteLength).arrayBuffer());
  if (!equalBytes(actualMagic, magicBytes)) throw new Error("This is not a Lamdan lecture backup.");

  let offset = magicBytes.byteLength;
  const first = await readRecord(blob, offset, options.signal);
  offset = first.nextOffset;
  if (first.header.id !== "bundle-manifest" || first.header.metadata?.bundleManifest !== true) {
    throw new Error("The lecture backup manifest record is missing.");
  }
  const manifest = parseManifest(await first.payload.text());
  validateLectureBackupManifest(manifest);
  if ((await sha256Blob(first.payload)) !== first.header.sha256) {
    throw new Error("The lecture backup manifest checksum does not match.");
  }

  let verifiedRecords = 0;
  for (const expected of manifest.records) {
    throwIfAborted(options.signal);
    const record = await readRecord(blob, offset, options.signal);
    offset = record.nextOffset;
    if (
      record.header.id !== expected.id ||
      record.header.kind !== expected.kind ||
      record.header.size !== expected.size ||
      record.header.sha256 !== expected.sha256
    ) {
      throw new Error(`Lecture backup record order or metadata mismatch at ${expected.id}.`);
    }
    if ((await sha256Blob(record.payload)) !== expected.sha256) {
      throw new Error(`Lecture backup checksum mismatch for ${expected.id}.`);
    }
    verifiedRecords += 1;
    options.onProgress?.({
      phase: "verifying",
      completedRecords: verifiedRecords,
      totalRecords: manifest.records.length,
      processedBytes: offset,
      totalBytes: blob.size,
      currentKind: expected.kind,
    });
  }
  if (offset !== blob.size)
    throw new Error("The lecture backup contains unexpected trailing data.");
  return { manifest, verifiedRecords, bytes: blob.size };
}

export function validateLectureBackupManifest(manifest: LectureBackupManifest): void {
  if (manifest.format !== LECTURE_BACKUP_FORMAT || manifest.version !== LECTURE_BACKUP_VERSION) {
    throw new Error("Unsupported lecture backup format or version.");
  }
  if (!manifest.materialId || !manifest.sourceUploadId || !manifest.sourceFileName) {
    throw new Error("The lecture backup manifest is missing source identity.");
  }
  if (!Array.isArray(manifest.records) || manifest.records.length < 2) {
    throw new Error("The lecture backup contains no usable records.");
  }
  const ids = new Set<string>();
  let payloadBytes = 0;
  let rawMediaBytes = 0;
  let manifestCount = 0;
  let materialCount = 0;
  for (const record of manifest.records) {
    if (!record.id || ids.has(record.id))
      throw new Error("Lecture backup record ids must be unique.");
    ids.add(record.id);
    if (!Number.isSafeInteger(record.size) || record.size < 0) {
      throw new Error(`Invalid lecture backup size for ${record.id}.`);
    }
    if (!/^[a-f0-9]{64}$/.test(record.sha256)) {
      throw new Error(`Invalid lecture backup checksum for ${record.id}.`);
    }
    payloadBytes += record.size;
    if (record.kind === "mediaChunk") rawMediaBytes += record.size;
    if (record.kind === "longMediaManifest") manifestCount += 1;
    if (record.kind === "coreMaterial") materialCount += 1;
  }
  if (manifestCount !== 1 || materialCount !== 1) {
    throw new Error("The lecture backup requires exactly one material and media manifest.");
  }
  if (payloadBytes !== manifest.payloadBytes || rawMediaBytes !== manifest.rawMediaBytes) {
    throw new Error("Lecture backup byte totals do not match its record list.");
  }
}

export function estimateLectureBackupFileBytes(manifest: LectureBackupManifest): number {
  validateLectureBackupManifest(manifest);
  const manifestBytes = encodeJson(manifest);
  const manifestDescriptor: LectureBackupRecordDescriptor = {
    id: "bundle-manifest",
    kind: "longMediaManifest",
    size: manifestBytes.byteLength,
    sha256: "0".repeat(64),
    metadata: { bundleManifest: true },
  };
  return (
    encoder.encode(LECTURE_BACKUP_MAGIC).byteLength +
    frameByteLength(manifestDescriptor) +
    manifest.records.reduce((sum, descriptor) => sum + frameByteLength(descriptor), 0)
  );
}

function frameByteLength(descriptor: LectureBackupRecordDescriptor): number {
  return FRAME_PREFIX_BYTES + encodeJson(toHeader(descriptor)).byteLength + descriptor.size;
}

async function loadPayload(
  manifest: LectureBackupManifest,
  descriptor: LectureBackupRecordDescriptor,
): Promise<PreparedPayload> {
  const materialId = manifest.materialId;
  switch (descriptor.kind) {
    case "coreMaterial": {
      const material = getDataSnapshot().materials.find((item) => item.id === materialId);
      if (!material) throw new Error("The core lecture material disappeared during export.");
      return { descriptor, data: encodeJson(material) };
    }
    case "longMediaManifest": {
      const current = await requiredManifest(materialId);
      return { descriptor, data: encodeJson(current) };
    }
    case "transcriptDraft": {
      const transcript = await getLongMediaTranscript(materialId);
      if (!transcript) throw new Error("The transcript draft disappeared during export.");
      return { descriptor, data: encodeJson(transcript) };
    }
    case "automaticTranscriptionJob": {
      const job = await getAutomaticTranscriptionJob(materialId);
      if (!job) throw new Error("The automatic transcription candidate disappeared during export.");
      return { descriptor, data: encodeJson(job) };
    }
    case "resumableTranscriptionJob": {
      const job = await getResumableTranscriptionJob(materialId);
      if (!job) throw new Error("The resumable transcription queue disappeared during export.");
      return { descriptor, data: encodeJson(job) };
    }
    case "mediaChunk": {
      const index = Number(descriptor.metadata?.index);
      if (!Number.isInteger(index) || index < 0) throw new Error("Invalid media chunk descriptor.");
      const media = await requiredManifest(materialId);
      const chunk = await requiredMediaChunk(media, index);
      return { descriptor, data: chunk.blob };
    }
    case "rangeClip": {
      const rangeId = String(descriptor.metadata?.rangeId ?? "");
      const clip = await getResumableRangeClip(materialId, rangeId);
      if (!clip) throw new Error(`Local range clip ${rangeId} disappeared during export.`);
      return { descriptor, data: clip.blob };
    }
  }
}

async function writeRecord(
  writable: WritableFileLike,
  descriptor: LectureBackupRecordDescriptor,
  data: Blob | Uint8Array,
): Promise<number> {
  const headerBytes = encodeJson(toHeader(descriptor));
  if (headerBytes.byteLength > MAX_LECTURE_BACKUP_HEADER_BYTES) {
    throw new Error(`Lecture backup header is too large for ${descriptor.id}.`);
  }
  const prefix = new Uint8Array(FRAME_PREFIX_BYTES);
  new DataView(prefix.buffer).setUint32(0, headerBytes.byteLength, false);
  await writable.write(toArrayBuffer(prefix));
  await writable.write(toArrayBuffer(headerBytes));
  await writable.write(data instanceof Blob ? data : toArrayBuffer(data));
  return prefix.byteLength + headerBytes.byteLength + descriptor.size;
}

async function readRecord(
  blob: Blob,
  offset: number,
  signal?: AbortSignal,
): Promise<{ header: RecordHeader; payload: Blob; nextOffset: number }> {
  throwIfAborted(signal);
  if (offset + FRAME_PREFIX_BYTES > blob.size)
    throw new Error("The lecture backup frame is truncated.");
  const prefix = await blob.slice(offset, offset + FRAME_PREFIX_BYTES).arrayBuffer();
  const headerLength = new DataView(prefix).getUint32(0, false);
  if (headerLength <= 0 || headerLength > MAX_LECTURE_BACKUP_HEADER_BYTES) {
    throw new Error("The lecture backup has an invalid record header length.");
  }
  const headerStart = offset + FRAME_PREFIX_BYTES;
  const payloadStart = headerStart + headerLength;
  if (payloadStart > blob.size) throw new Error("The lecture backup header is truncated.");
  const rawHeader = await blob.slice(headerStart, payloadStart).text();
  const header = parseHeader(rawHeader);
  const payloadEnd = payloadStart + header.size;
  if (payloadEnd > blob.size) throw new Error(`Lecture backup payload is truncated: ${header.id}.`);
  return { header, payload: blob.slice(payloadStart, payloadEnd), nextOffset: payloadEnd };
}

function toHeader(descriptor: LectureBackupRecordDescriptor): RecordHeader {
  return {
    format: LECTURE_BACKUP_FORMAT,
    version: LECTURE_BACKUP_VERSION,
    ...descriptor,
  };
}

function parseHeader(raw: string): RecordHeader {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("The lecture backup record header is not valid JSON.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("The lecture backup record header is invalid.");
  }
  const header = parsed as RecordHeader;
  if (
    header.format !== LECTURE_BACKUP_FORMAT ||
    header.version !== LECTURE_BACKUP_VERSION ||
    !header.id ||
    !header.kind ||
    !Number.isSafeInteger(header.size) ||
    header.size < 0 ||
    !/^[a-f0-9]{64}$/.test(header.sha256)
  ) {
    throw new Error("The lecture backup record header failed validation.");
  }
  return header;
}

function parseManifest(raw: string): LectureBackupManifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("The lecture backup manifest is not valid JSON.");
  }
  return parsed as LectureBackupManifest;
}

function clipMetadata(clip: ResumableRangeClipRecord): LectureBackupRecordDescriptor["metadata"] {
  return {
    materialId: clip.materialId,
    sourceUploadId: clip.sourceUploadId,
    rangeId: clip.rangeId,
    startSeconds: clip.startSeconds,
    endSeconds: clip.endSeconds,
    durationSeconds: clip.durationSeconds,
    fileName: clip.fileName,
    mimeType: clip.mimeType,
    createdAt: clip.createdAt,
    updatedAt: clip.updatedAt,
  };
}

function assertSourceIdentity(
  manifest: LongMediaManifest,
  transcript: LongMediaTranscriptDraft | undefined,
  automaticJob: AutomaticTranscriptionJob | undefined,
  resumableJob: ResumableTranscriptionJob | undefined,
): void {
  for (const source of [transcript, automaticJob, resumableJob]) {
    if (source && source.sourceUploadId !== manifest.uploadId) {
      throw new Error("A lecture backup companion record belongs to an older source upload.");
    }
  }
}

async function assertCurrentUpload(manifest: LectureBackupManifest): Promise<void> {
  const current = await requiredManifest(manifest.materialId);
  if (current.uploadId !== manifest.sourceUploadId) {
    throw new Error("The lecture recording changed after this backup was prepared.");
  }
}

async function requiredManifest(materialId: string): Promise<LongMediaManifest> {
  const manifest = await getLongMediaManifest(materialId);
  if (!manifest) throw new Error("The locally stored lecture manifest is missing.");
  return manifest;
}

async function requiredMediaChunk(
  manifest: LongMediaManifest,
  index: number,
): Promise<LongMediaChunkRecord> {
  const chunk = await getLongMediaChunkRecord(manifest.uploadId, index);
  if (
    !chunk ||
    chunk.materialId !== manifest.materialId ||
    chunk.uploadId !== manifest.uploadId ||
    chunk.index !== index ||
    chunk.size !== chunk.blob.size
  ) {
    throw new Error(`The locally stored lecture chunk ${index + 1} is missing or inconsistent.`);
  }
  return chunk;
}

function safeBackupName(fileName: string, materialId: string): string {
  const base = fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9а-яёא-ת_-]+/gi, "-")
    .slice(0, 80);
  return `${base || materialId}-${new Date().toISOString().slice(0, 10)}${LECTURE_BACKUP_EXTENSION}`;
}

function encodeJson(value: unknown): Uint8Array {
  return encoder.encode(JSON.stringify(value));
}

async function sha256Blob(blob: Blob): Promise<string> {
  return bytesToHex(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()));
}

async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  return bytesToHex(await crypto.subtle.digest("SHA-256", toArrayBuffer(bytes)));
}

function bytesToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (value) => value.toString(16).padStart(2, "0")).join(
    "",
  );
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  return (
    left.byteLength === right.byteLength && left.every((value, index) => value === right[index])
  );
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Lecture backup cancelled.", "AbortError");
}
