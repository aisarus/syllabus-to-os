import type {
  LongMediaManifest,
  LongMediaTranscriptDraft,
  TranscriptSegmentDraft,
} from "./long-media";

export const GEMINI_TRANSCRIPTION_PROVIDER = "google-gemini-files" as const;
export const GEMINI_TRANSCRIPTION_PROVIDER_NAME = "Google Gemini Files API";
export const GEMINI_TRANSCRIPTION_MAX_BYTES = 2 * 1024 * 1024 * 1024;
export const GEMINI_TRANSCRIPTION_RETENTION_HOURS = 48;
export const DEFAULT_TRANSCRIPTION_RANGE_SECONDS = 10 * 60;

export type LongMediaTranscriptionProvider = typeof GEMINI_TRANSCRIPTION_PROVIDER;
export type LongMediaTranscriptionJobStatus =
  | "awaiting_consent"
  | "uploading"
  | "processing"
  | "paused"
  | "completed"
  | "cancelled"
  | "failed";
export type LongMediaTranscriptionRangeStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export interface LongMediaTranscriptionRange {
  id: string;
  startSeconds: number;
  endSeconds: number;
  status: LongMediaTranscriptionRangeStatus;
  attempts: number;
  segmentCount: number;
  error?: string;
  updatedAt: number;
}

export interface LongMediaTranscriptionJob {
  id: string;
  materialId: string;
  sourceUploadId: string;
  provider: LongMediaTranscriptionProvider;
  providerName: string;
  fileName: string;
  fileSize: number;
  status: LongMediaTranscriptionJobStatus;
  ranges: LongMediaTranscriptionRange[];
  uploadedBytes: number;
  providerFileName?: string;
  providerFileUri?: string;
  consentedAt?: number;
  completedAt?: number;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProviderTranscriptSegment {
  startSeconds: number;
  endSeconds: number;
  text: string;
  speaker?: string;
  language?: string;
  unclear?: boolean;
}

export interface ProviderTranscriptionRangeResult {
  provider: LongMediaTranscriptionProvider;
  jobId: string;
  rangeId: string;
  startSeconds: number;
  endSeconds: number;
  segments: ProviderTranscriptSegment[];
  missingIntervals: Array<{
    startSeconds: number;
    endSeconds: number;
    reason: string;
  }>;
}

export interface TranscriptionEligibility {
  ok: boolean;
  message?: string;
}

export function validateGeminiTranscriptionEligibility(
  manifest: Pick<LongMediaManifest, "size" | "durationSeconds">,
): TranscriptionEligibility {
  if (manifest.size > GEMINI_TRANSCRIPTION_MAX_BYTES) {
    return {
      ok: false,
      message: "Google Gemini transcription accepts files up to 2 GB. Keep this recording local or split it before sending.",
    };
  }
  if (!manifest.durationSeconds || manifest.durationSeconds <= 0) {
    return {
      ok: false,
      message: "Load the local player once so Lamdan can determine the lecture duration.",
    };
  }
  return { ok: true };
}

export function buildTranscriptionRanges(
  durationSeconds: number,
  rangeSeconds = DEFAULT_TRANSCRIPTION_RANGE_SECONDS,
  now = Date.now(),
): LongMediaTranscriptionRange[] {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return [];
  const bounded = Math.max(60, Math.min(30 * 60, Math.round(rangeSeconds)));
  return Array.from({ length: Math.ceil(durationSeconds / bounded) }, (_, index) => {
    const startSeconds = index * bounded;
    const endSeconds = Math.min(durationSeconds, startSeconds + bounded);
    return {
      id: `range_${index}_${Math.round(startSeconds)}`,
      startSeconds,
      endSeconds,
      status: "pending" as const,
      attempts: 0,
      segmentCount: 0,
      updatedAt: now,
    };
  });
}

export function createLongMediaTranscriptionJob(
  manifest: LongMediaManifest,
  now = Date.now(),
): LongMediaTranscriptionJob {
  const eligibility = validateGeminiTranscriptionEligibility(manifest);
  if (!eligibility.ok) throw new Error(eligibility.message);
  return {
    id: `trjob_${manifest.materialId}_${now.toString(36)}`,
    materialId: manifest.materialId,
    sourceUploadId: manifest.uploadId,
    provider: GEMINI_TRANSCRIPTION_PROVIDER,
    providerName: GEMINI_TRANSCRIPTION_PROVIDER_NAME,
    fileName: manifest.fileName,
    fileSize: manifest.size,
    status: "awaiting_consent",
    ranges: buildTranscriptionRanges(manifest.durationSeconds ?? 0, undefined, now),
    uploadedBytes: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeProviderSegments(
  result: ProviderTranscriptionRangeResult,
): TranscriptSegmentDraft[] {
  const accepted = result.segments
    .filter(
      (segment) =>
        Number.isFinite(segment.startSeconds) &&
        Number.isFinite(segment.endSeconds) &&
        segment.startSeconds >= result.startSeconds &&
        segment.endSeconds <= result.endSeconds + 0.001 &&
        segment.endSeconds > segment.startSeconds,
    )
    .map((segment, index) => ({
      id: `seg_provider_${result.rangeId}_${index}_${Math.round(segment.startSeconds * 1000)}`,
      startSeconds: segment.startSeconds,
      endSeconds: segment.endSeconds,
      text: segment.text.trim(),
      status: segment.text.trim() ? ("draft" as const) : ("empty" as const),
      speaker: cleanOptional(segment.speaker),
      language: cleanOptional(segment.language),
      unclear: Boolean(segment.unclear),
      provider: result.provider,
      providerJobId: result.jobId,
    }));
  const missing = result.missingIntervals
    .filter(
      (interval) =>
        Number.isFinite(interval.startSeconds) &&
        Number.isFinite(interval.endSeconds) &&
        interval.startSeconds >= result.startSeconds &&
        interval.endSeconds <= result.endSeconds + 0.001 &&
        interval.endSeconds > interval.startSeconds,
    )
    .map((interval, index) => ({
      id: `seg_missing_${result.rangeId}_${index}_${Math.round(interval.startSeconds * 1000)}`,
      startSeconds: interval.startSeconds,
      endSeconds: interval.endSeconds,
      text: interval.reason.trim(),
      status: "draft" as const,
      unclear: true,
      provider: result.provider,
      providerJobId: result.jobId,
    }));
  return [...accepted, ...missing].sort(
    (left, right) => left.startSeconds - right.startSeconds || left.endSeconds - right.endSeconds,
  );
}

export function mergeProviderRangeIntoTranscript(
  current: LongMediaTranscriptDraft | undefined,
  manifest: LongMediaManifest,
  result: ProviderTranscriptionRangeResult,
  now = Date.now(),
): LongMediaTranscriptDraft {
  if (result.jobId.trim().length === 0) throw new Error("Transcription result has no job id.");
  if (result.startSeconds < 0 || result.endSeconds <= result.startSeconds) {
    throw new Error("Transcription result has an invalid time range.");
  }
  if (current && current.sourceUploadId !== manifest.uploadId) {
    throw new Error("The current transcript belongs to an older lecture upload.");
  }

  const approved = current?.segments.filter(
    (segment) => segment.status === "approved" && overlapsRange(segment, result),
  );
  const outside =
    current?.segments.filter(
      (segment) => !overlapsRange(segment, result) || segment.status === "approved",
    ) ?? [];
  const providerDrafts = normalizeProviderSegments(result).filter(
    (segment) => !(approved ?? []).some((locked) => overlaps(segment, locked)),
  );
  const segments = dedupeSegments([...outside, ...providerDrafts]).sort(
    (left, right) => left.startSeconds - right.startSeconds || left.endSeconds - right.endSeconds,
  );

  return {
    materialId: manifest.materialId,
    sourceUploadId: manifest.uploadId,
    segments,
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
  };
}

export function nextPendingTranscriptionRange(
  job: LongMediaTranscriptionJob,
): LongMediaTranscriptionRange | undefined {
  return job.ranges.find((range) => range.status === "pending" || range.status === "failed");
}

export function summarizeTranscriptionJob(job: LongMediaTranscriptionJob): {
  completedRanges: number;
  totalRanges: number;
  failedRanges: number;
  percent: number;
} {
  const completedRanges = job.ranges.filter((range) => range.status === "completed").length;
  const failedRanges = job.ranges.filter((range) => range.status === "failed").length;
  return {
    completedRanges,
    totalRanges: job.ranges.length,
    failedRanges,
    percent: job.ranges.length === 0 ? 0 : Math.round((completedRanges / job.ranges.length) * 100),
  };
}

function cleanOptional(value: string | undefined): string | undefined {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
}

function overlapsRange(
  segment: Pick<TranscriptSegmentDraft, "startSeconds" | "endSeconds">,
  range: Pick<ProviderTranscriptionRangeResult, "startSeconds" | "endSeconds">,
): boolean {
  return segment.startSeconds < range.endSeconds && segment.endSeconds > range.startSeconds;
}

function overlaps(
  left: Pick<TranscriptSegmentDraft, "startSeconds" | "endSeconds">,
  right: Pick<TranscriptSegmentDraft, "startSeconds" | "endSeconds">,
): boolean {
  return left.startSeconds < right.endSeconds && left.endSeconds > right.startSeconds;
}

function dedupeSegments(segments: TranscriptSegmentDraft[]): TranscriptSegmentDraft[] {
  const seen = new Set<string>();
  const result: TranscriptSegmentDraft[] = [];
  for (const segment of segments) {
    const key = [
      Math.round(segment.startSeconds * 1000),
      Math.round(segment.endSeconds * 1000),
      segment.text.trim().toLocaleLowerCase(),
      segment.status,
    ].join(":");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(segment);
  }
  return result;
}
