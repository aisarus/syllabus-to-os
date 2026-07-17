import type { AutomaticTranscriptionJob } from "./automatic-transcription";
import {
  deleteAutomaticTranscriptionJob,
  putAutomaticTranscriptionJob,
} from "./automatic-transcription-store";
import {
  inspectLectureBackupBlob,
  LECTURE_BACKUP_FORMAT,
  LECTURE_BACKUP_MAGIC,
  LECTURE_BACKUP_VERSION,
  MAX_LECTURE_BACKUP_HEADER_BYTES,
  type LectureBackupManifest,
  type LectureBackupRecordDescriptor,
  type LectureBackupRecordKind,
} from "./lecture-backup";
import type { LongMediaManifest, LongMediaTranscriptDraft } from "./long-media";
import {
  commitLongMediaBackupManifest,
  deleteLongMediaData,
  deleteLongMediaUploadChunks,
  putLongMediaBackupChunk,
  putLongMediaTranscript,
} from "./long-media-store";
import type { ResumableTranscriptionJob } from "./resumable-transcription";
import {
  deleteResumableTranscriptionJob,
  putResumableRangeClip,
  putResumableTranscriptionJob,
  type ResumableRangeClipRecord,
} from "./resumable-transcription-store";
import { getDataSnapshot, uid, updateData, type Material } from "./store";

const encoder = new TextEncoder();
const FRAME_PREFIX_BYTES = 4;

interface LectureBackupRecordHeader extends LectureBackupRecordDescriptor {
  format: typeof LECTURE_BACKUP_FORMAT;
  version: typeof LECTURE_BACKUP_VERSION;
}

export interface LectureRestorePlan {
  file: File;
  sourceManifest: LectureBackupManifest;
  sourceMaterial: Material;
  sourceMediaManifest: LongMediaManifest;
  targetMaterialId: string;
  targetUploadId: string;
  restoredTitle: string;
  mediaChunkCount: number;
  localClipCount: number;
  includesTranscriptDraft: boolean;
  includesAutomaticCandidate: boolean;
  includesResumableQueue: boolean;
}

export interface LectureRestoreProgress {
  phase: "verifying" | "staging" | "publishing" | "rolling_back";
  completedRecords: number;
  totalRecords: number;
  processedBytes: number;
  totalBytes: number;
  currentKind?: LectureBackupRecordKind;
}

export interface LectureRestoreResult {
  materialId: string;
  uploadId: string;
  restoredTitle: string;
  mediaChunkCount: number;
  localClipCount: number;
}

export async function prepareLectureRestore(
  file: File,
  options: {
    signal?: AbortSignal;
    onProgress?: (progress: LectureRestoreProgress) => void;
  } = {},
): Promise<LectureRestorePlan> {
  if (!(file instanceof File) || file.size <= 0) {
    throw new Error("Choose a non-empty Lamdan lecture backup file.");
  }
  throwIfAborted(options.signal);
  const inspection = await inspectLectureBackupBlob(file, {
    signal: options.signal,
    onProgress: (progress) =>
      options.onProgress?.({
        phase: "verifying",
        completedRecords: progress.completedRecords,
        totalRecords: progress.totalRecords,
        processedBytes: progress.processedBytes,
        totalBytes: progress.totalBytes,
        currentKind: progress.currentKind as LectureBackupRecordKind | undefined,
      }),
  });
  const selected = await readSelectedJsonRecords(
    file,
    inspection.manifest,
    new Set(["core-material", "long-media-manifest"]),
    options.signal,
  );
  const sourceMaterial = validateSourceMaterial(selected.get("core-material"));
  const sourceMediaManifest = validateSourceMediaManifest(
    selected.get("long-media-manifest"),
    inspection.manifest,
  );
  if (sourceMaterial.id !== inspection.manifest.materialId) {
    throw new Error("The lecture backup material identity does not match its manifest.");
  }
  const targetMaterialId = uid("mat");
  const targetUploadId = uniqueUploadId();
  return {
    file,
    sourceManifest: inspection.manifest,
    sourceMaterial,
    sourceMediaManifest,
    targetMaterialId,
    targetUploadId,
    restoredTitle: `${sourceMaterial.title} (restored)`,
    mediaChunkCount: inspection.manifest.records.filter((record) => record.kind === "mediaChunk")
      .length,
    localClipCount: inspection.manifest.records.filter((record) => record.kind === "rangeClip")
      .length,
    includesTranscriptDraft: inspection.manifest.records.some(
      (record) => record.kind === "transcriptDraft",
    ),
    includesAutomaticCandidate: inspection.manifest.records.some(
      (record) => record.kind === "automaticTranscriptionJob",
    ),
    includesResumableQueue: inspection.manifest.records.some(
      (record) => record.kind === "resumableTranscriptionJob",
    ),
  };
}

export async function restoreLectureBackup(
  plan: LectureRestorePlan,
  options: {
    signal?: AbortSignal;
    onProgress?: (progress: LectureRestoreProgress) => void;
  } = {},
): Promise<LectureRestoreResult> {
  if (getDataSnapshot().materials.some((material) => material.id === plan.targetMaterialId)) {
    throw new Error("The prepared restore target already exists. Prepare the backup again.");
  }
  const totalRecords = plan.sourceManifest.records.length;
  let completedRecords = 0;
  let processedBytes = encoder.encode(LECTURE_BACKUP_MAGIC).byteLength;
  let coreMaterial: Material | undefined;
  let mediaManifest: LongMediaManifest | undefined;
  let transcript: LongMediaTranscriptDraft | undefined;
  let automaticJob: AutomaticTranscriptionJob | undefined;
  let resumableJob: ResumableTranscriptionJob | undefined;
  let stagedClipCount = 0;
  let corePublished = false;

  const report = (phase: LectureRestoreProgress["phase"], currentKind?: LectureBackupRecordKind) =>
    options.onProgress?.({
      phase,
      completedRecords,
      totalRecords,
      processedBytes,
      totalBytes: plan.file.size,
      currentKind,
    });

  try {
    throwIfAborted(options.signal);
    const bundle = await readBundleManifest(plan.file, options.signal);
    assertSamePreparedManifest(plan.sourceManifest, bundle.manifest);
    let offset = bundle.nextOffset;
    processedBytes = offset;

    for (const expected of plan.sourceManifest.records) {
      throwIfAborted(options.signal);
      const frame = await readRecord(plan.file, offset, options.signal);
      offset = frame.nextOffset;
      processedBytes = offset;
      assertExpectedRecord(frame.header, expected);
      const actualHash = await sha256Blob(frame.payload);
      if (actualHash !== expected.sha256) {
        throw new Error(`Lecture backup checksum mismatch for ${expected.id}.`);
      }

      switch (expected.kind) {
        case "coreMaterial":
          coreMaterial = validateSourceMaterial(await parseJsonBlob(frame.payload, expected.id));
          break;
        case "longMediaManifest":
          mediaManifest = validateSourceMediaManifest(
            await parseJsonBlob(frame.payload, expected.id),
            plan.sourceManifest,
          );
          break;
        case "transcriptDraft":
          transcript = validateTranscriptDraft(await parseJsonBlob(frame.payload, expected.id));
          break;
        case "automaticTranscriptionJob":
          automaticJob = validateAutomaticJob(await parseJsonBlob(frame.payload, expected.id));
          break;
        case "resumableTranscriptionJob":
          resumableJob = validateResumableJob(await parseJsonBlob(frame.payload, expected.id));
          break;
        case "mediaChunk": {
          const index = Number(expected.metadata?.index);
          if (!Number.isInteger(index) || index < 0) {
            throw new Error(`Invalid media chunk index in ${expected.id}.`);
          }
          await putLongMediaBackupChunk({
            uploadId: plan.targetUploadId,
            materialId: plan.targetMaterialId,
            index,
            size: frame.payload.size,
            sha256: actualHash,
            blob: frame.payload,
            createdAt: Date.now(),
          });
          break;
        }
        case "rangeClip": {
          const metadata = expected.metadata ?? {};
          const rangeId = String(metadata.rangeId ?? "");
          if (!rangeId) throw new Error(`Range clip ${expected.id} has no range identity.`);
          await putResumableRangeClip({
            materialId: plan.targetMaterialId,
            sourceUploadId: plan.targetUploadId,
            rangeId,
            startSeconds: Number(metadata.startSeconds),
            endSeconds: Number(metadata.endSeconds),
            durationSeconds: Number(metadata.durationSeconds),
            fileName: String(metadata.fileName ?? `restored-${rangeId}.webm`),
            mimeType: String(metadata.mimeType ?? "audio/webm"),
            size: frame.payload.size,
            blob: frame.payload,
            createdAt: Number(metadata.createdAt) || Date.now(),
            updatedAt: Date.now(),
          });
          stagedClipCount += 1;
          break;
        }
      }
      completedRecords += 1;
      report("staging", expected.kind);
    }

    if (offset !== plan.file.size) {
      throw new Error("The lecture backup contains unexpected trailing data.");
    }
    if (!coreMaterial || !mediaManifest) {
      throw new Error("The lecture backup is missing required material records.");
    }
    assertSourceCompanionIdentity(plan.sourceManifest, transcript, automaticJob, resumableJob);
    validateRestoreChunkLayout(plan.sourceManifest, mediaManifest);

    report("publishing");
    const now = Date.now();
    const restoredManifest: LongMediaManifest = {
      ...mediaManifest,
      materialId: plan.targetMaterialId,
      uploadId: plan.targetUploadId,
      createdAt: now,
      updatedAt: now,
    };
    await commitLongMediaBackupManifest(restoredManifest);

    if (transcript) {
      await putLongMediaTranscript({
        ...transcript,
        materialId: plan.targetMaterialId,
        sourceUploadId: plan.targetUploadId,
        createdAt: now,
        updatedAt: now,
      });
    }
    if (automaticJob) {
      await putAutomaticTranscriptionJob({
        ...automaticJob,
        materialId: plan.targetMaterialId,
        sourceUploadId: plan.targetUploadId,
        createdAt: now,
        updatedAt: now,
      });
    }
    if (resumableJob) {
      await putResumableTranscriptionJob({
        ...resumableJob,
        materialId: plan.targetMaterialId,
        sourceUploadId: plan.targetUploadId,
        revision: 0,
        createdAt: now,
        updatedAt: now,
      });
    }

    const restoredMaterial = buildRestoredMaterial(coreMaterial, restoredManifest, plan, now);
    updateData((data) => ({
      ...data,
      materials: [restoredMaterial, ...data.materials],
    }));
    corePublished = true;
    report("publishing");
    return {
      materialId: plan.targetMaterialId,
      uploadId: plan.targetUploadId,
      restoredTitle: restoredMaterial.title,
      mediaChunkCount: plan.mediaChunkCount,
      localClipCount: stagedClipCount,
    };
  } catch (error) {
    report("rolling_back");
    await rollbackRestore(plan, corePublished);
    throw error;
  }
}

async function rollbackRestore(plan: LectureRestorePlan, corePublished: boolean): Promise<void> {
  if (corePublished) {
    updateData((data) => ({
      ...data,
      materials: data.materials.filter((material) => material.id !== plan.targetMaterialId),
      materialChunks: data.materialChunks.filter(
        (chunk) => chunk.materialId !== plan.targetMaterialId,
      ),
      materialOutputs: data.materialOutputs.filter(
        (output) => output.materialId !== plan.targetMaterialId,
      ),
    }));
  }
  await Promise.allSettled([
    deleteLongMediaData(plan.targetMaterialId),
    deleteLongMediaUploadChunks(plan.targetUploadId),
    deleteAutomaticTranscriptionJob(plan.targetMaterialId),
    deleteResumableTranscriptionJob(plan.targetMaterialId),
  ]);
}

function buildRestoredMaterial(
  source: Material,
  manifest: LongMediaManifest,
  plan: LectureRestorePlan,
  now: number,
): Material {
  return {
    ...source,
    id: plan.targetMaterialId,
    title: plan.restoredTitle.trim() || `${source.title} (restored)`,
    courseId: undefined,
    topicId: undefined,
    fileName: manifest.fileName,
    mimeType: manifest.mimeType,
    fileSize: manifest.size,
    tags: Array.from(new Set([...(source.tags ?? []), "long-media", "restored-backup"])),
    rawText: "",
    processingStatus: "no_text",
    processingMessage: "Lecture restored from a verified streaming backup.",
    wordCount: 0,
    charCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

async function readSelectedJsonRecords(
  blob: Blob,
  manifest: LectureBackupManifest,
  selectedIds: Set<string>,
  signal?: AbortSignal,
): Promise<Map<string, unknown>> {
  const bundle = await readBundleManifest(blob, signal);
  assertSamePreparedManifest(manifest, bundle.manifest);
  let offset = bundle.nextOffset;
  const values = new Map<string, unknown>();
  for (const expected of manifest.records) {
    const frame = await readRecord(blob, offset, signal);
    offset = frame.nextOffset;
    assertExpectedRecord(frame.header, expected);
    if (selectedIds.has(expected.id)) {
      values.set(expected.id, await parseJsonBlob(frame.payload, expected.id));
      if (values.size === selectedIds.size) break;
    }
  }
  return values;
}

async function readBundleManifest(
  blob: Blob,
  signal?: AbortSignal,
): Promise<{ manifest: LectureBackupManifest; nextOffset: number }> {
  throwIfAborted(signal);
  const magic = encoder.encode(LECTURE_BACKUP_MAGIC);
  if (blob.size < magic.byteLength + FRAME_PREFIX_BYTES) {
    throw new Error("The lecture backup is truncated.");
  }
  const actualMagic = new Uint8Array(await blob.slice(0, magic.byteLength).arrayBuffer());
  if (!equalBytes(actualMagic, magic)) throw new Error("This is not a Lamdan lecture backup.");
  const frame = await readRecord(blob, magic.byteLength, signal);
  if (frame.header.id !== "bundle-manifest" || frame.header.metadata?.bundleManifest !== true) {
    throw new Error("The lecture backup manifest record is missing.");
  }
  if ((await sha256Blob(frame.payload)) !== frame.header.sha256) {
    throw new Error("The lecture backup manifest checksum does not match.");
  }
  const manifest = (await parseJsonBlob(frame.payload, "bundle-manifest")) as LectureBackupManifest;
  if (manifest.format !== LECTURE_BACKUP_FORMAT || manifest.version !== LECTURE_BACKUP_VERSION) {
    throw new Error("Unsupported lecture backup format or version.");
  }
  return { manifest, nextOffset: frame.nextOffset };
}

async function readRecord(
  blob: Blob,
  offset: number,
  signal?: AbortSignal,
): Promise<{ header: LectureBackupRecordHeader; payload: Blob; nextOffset: number }> {
  throwIfAborted(signal);
  if (offset + FRAME_PREFIX_BYTES > blob.size) {
    throw new Error("The lecture backup frame is truncated.");
  }
  const prefix = await blob.slice(offset, offset + FRAME_PREFIX_BYTES).arrayBuffer();
  const headerLength = new DataView(prefix).getUint32(0, false);
  if (headerLength <= 0 || headerLength > MAX_LECTURE_BACKUP_HEADER_BYTES) {
    throw new Error("The lecture backup has an invalid record header length.");
  }
  const headerStart = offset + FRAME_PREFIX_BYTES;
  const payloadStart = headerStart + headerLength;
  if (payloadStart > blob.size) throw new Error("The lecture backup header is truncated.");
  const header = parseHeader(await blob.slice(headerStart, payloadStart).text());
  const payloadEnd = payloadStart + header.size;
  if (payloadEnd > blob.size) {
    throw new Error(`Lecture backup payload is truncated: ${header.id}.`);
  }
  return {
    header,
    payload: blob.slice(payloadStart, payloadEnd),
    nextOffset: payloadEnd,
  };
}

function parseHeader(raw: string): LectureBackupRecordHeader {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("The lecture backup record header is not valid JSON.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The lecture backup record header is invalid.");
  }
  const header = value as LectureBackupRecordHeader;
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

function assertExpectedRecord(
  header: LectureBackupRecordHeader,
  expected: LectureBackupRecordDescriptor,
): void {
  if (
    header.id !== expected.id ||
    header.kind !== expected.kind ||
    header.size !== expected.size ||
    header.sha256 !== expected.sha256
  ) {
    throw new Error(`Lecture backup record order or metadata mismatch at ${expected.id}.`);
  }
}

function assertSamePreparedManifest(
  prepared: LectureBackupManifest,
  actual: LectureBackupManifest,
): void {
  if (
    actual.materialId !== prepared.materialId ||
    actual.sourceUploadId !== prepared.sourceUploadId ||
    actual.payloadBytes !== prepared.payloadBytes ||
    actual.records.length !== prepared.records.length
  ) {
    throw new Error("The selected lecture backup changed after preparation.");
  }
}

function validateSourceMaterial(value: unknown): Material {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The lecture backup core material is invalid.");
  }
  const material = value as Material;
  if (!material.id || !material.title || !Array.isArray(material.tags)) {
    throw new Error("The lecture backup core material is missing required fields.");
  }
  return material;
}

function validateSourceMediaManifest(
  value: unknown,
  backup: LectureBackupManifest,
): LongMediaManifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The lecture backup media manifest is invalid.");
  }
  const manifest = value as LongMediaManifest;
  if (
    manifest.materialId !== backup.materialId ||
    manifest.uploadId !== backup.sourceUploadId ||
    manifest.fileName !== backup.sourceFileName ||
    manifest.mimeType !== backup.sourceMimeType ||
    manifest.size !== backup.rawMediaBytes ||
    !Number.isInteger(manifest.chunkCount) ||
    manifest.chunkCount <= 0
  ) {
    throw new Error("The lecture backup media manifest does not match the bundle identity.");
  }
  return manifest;
}

function validateTranscriptDraft(value: unknown): LongMediaTranscriptDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The lecture backup transcript draft is invalid.");
  }
  const draft = value as LongMediaTranscriptDraft;
  if (!draft.materialId || !draft.sourceUploadId || !Array.isArray(draft.segments)) {
    throw new Error("The lecture backup transcript draft is missing required fields.");
  }
  return draft;
}

function validateAutomaticJob(value: unknown): AutomaticTranscriptionJob {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The lecture backup automatic transcription job is invalid.");
  }
  const job = value as AutomaticTranscriptionJob;
  if (!job.materialId || !job.sourceUploadId || !Array.isArray(job.resultSegments)) {
    throw new Error("The lecture backup automatic transcription job is missing required fields.");
  }
  return job;
}

function validateResumableJob(value: unknown): ResumableTranscriptionJob {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The lecture backup resumable queue is invalid.");
  }
  const job = value as ResumableTranscriptionJob;
  if (!job.materialId || !job.sourceUploadId || !Array.isArray(job.ranges)) {
    throw new Error("The lecture backup resumable queue is missing required fields.");
  }
  return job;
}

function assertSourceCompanionIdentity(
  manifest: LectureBackupManifest,
  transcript: LongMediaTranscriptDraft | undefined,
  automaticJob: AutomaticTranscriptionJob | undefined,
  resumableJob: ResumableTranscriptionJob | undefined,
): void {
  for (const record of [transcript, automaticJob, resumableJob]) {
    if (
      record &&
      (record.materialId !== manifest.materialId ||
        record.sourceUploadId !== manifest.sourceUploadId)
    ) {
      throw new Error("A lecture backup companion record has stale source identity.");
    }
  }
}

function validateRestoreChunkLayout(backup: LectureBackupManifest, media: LongMediaManifest): void {
  const chunks = backup.records
    .filter((record) => record.kind === "mediaChunk")
    .map((record) => ({
      index: Number(record.metadata?.index),
      size: record.size,
    }))
    .sort((left, right) => left.index - right.index);
  if (chunks.length !== media.chunkCount) {
    throw new Error("The lecture backup media chunk count does not match its manifest.");
  }
  for (let index = 0; index < chunks.length; index += 1) {
    if (chunks[index]?.index !== index) {
      throw new Error("The lecture backup media chunk indexes are incomplete.");
    }
  }
  if (chunks.reduce((sum, chunk) => sum + chunk.size, 0) !== media.size) {
    throw new Error("The lecture backup media chunk sizes do not match its manifest.");
  }
}

async function parseJsonBlob(blob: Blob, id: string): Promise<unknown> {
  try {
    return JSON.parse(await blob.text());
  } catch {
    throw new Error(`Lecture backup JSON payload is invalid: ${id}.`);
  }
}

async function sha256Blob(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join(
    "",
  );
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  return (
    left.byteLength === right.byteLength && left.every((value, index) => value === right[index])
  );
}

function uniqueUploadId(): string {
  return `media_restore_${crypto.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Lecture restore cancelled.", "AbortError");
}
