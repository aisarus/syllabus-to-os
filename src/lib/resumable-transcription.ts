import type {
  LongMediaManifest,
  LongMediaTranscriptDraft,
  TranscriptSegmentDraft,
} from "./long-media";
import {
  findAutomaticTranscriptionGaps,
  normalizeAutomaticSegments,
  validateAutomaticTranscriptionFile,
  type AutomaticTranscriptSegment,
  type AutomaticTranscriptionProvider,
  type AutomaticTranscriptionProviderStatus,
  type AutomaticTranscriptionResponse,
} from "./automatic-transcription";

export const DEFAULT_RESUMABLE_RANGE_SECONDS = 15 * 60;
export const DEFAULT_RESUMABLE_OVERLAP_SECONDS = 2;
export const MAX_RESUMABLE_RANGES = 96;

export type ResumableTranscriptionRangeStatus =
  | "needs_file"
  | "ready"
  | "uploading"
  | "processing"
  | "review_ready"
  | "cancelled"
  | "failed";

export type ResumableTranscriptionJobStatus =
  | "planning"
  | "ready"
  | "running"
  | "paused"
  | "partial_ready"
  | "review_ready"
  | "draft_loaded"
  | "cancelled";

export interface ResumableTranscriptionRange {
  id: string;
  index: number;
  startSeconds: number;
  endSeconds: number;
  status: ResumableTranscriptionRangeStatus;
  attempt: number;
  uploadProgress: number;
  selectedFileName?: string;
  selectedFileSize?: number;
  selectedFileMimeType?: string;
  providerRequestId?: string;
  resultSegments: AutomaticTranscriptSegment[];
  warnings: string[];
  error?: string;
  updatedAt: number;
}

export interface ResumableTranscriptionJob {
  materialId: string;
  sourceUploadId: string;
  durationSeconds: number;
  provider: AutomaticTranscriptionProvider;
  providerDisplayName: string;
  model: string;
  language?: string;
  requestSpeakerLabels: boolean;
  rangeSeconds: number;
  overlapSeconds: number;
  status: ResumableTranscriptionJobStatus;
  ranges: ResumableTranscriptionRange[];
  revision: number;
  createdAt: number;
  updatedAt: number;
}

interface RangeSegmentCandidate {
  rangeId: string;
  rangeStartSeconds: number;
  rangeEndSeconds: number;
  segment: AutomaticTranscriptSegment;
}

export function planResumableTranscriptionRanges(
  durationSeconds: number,
  rangeSeconds = DEFAULT_RESUMABLE_RANGE_SECONDS,
  overlapSeconds = DEFAULT_RESUMABLE_OVERLAP_SECONDS,
): ResumableTranscriptionRange[] {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return [];
  const duration = Math.max(1, durationSeconds);
  const boundedRange = Math.max(60, Math.min(30 * 60, Math.round(rangeSeconds)));
  const boundedOverlap = Math.max(0, Math.min(30, boundedRange / 4, overlapSeconds));
  const step = Math.max(1, boundedRange - boundedOverlap);
  const ranges: ResumableTranscriptionRange[] = [];
  let startSeconds = 0;

  while (startSeconds < duration && ranges.length < MAX_RESUMABLE_RANGES) {
    const index = ranges.length;
    const endSeconds = Math.min(duration, startSeconds + boundedRange);
    ranges.push({
      id: `range_${index}_${Math.round(startSeconds * 1000)}`,
      index,
      startSeconds,
      endSeconds,
      status: "needs_file",
      attempt: 0,
      uploadProgress: 0,
      resultSegments: [],
      warnings: [],
      updatedAt: Date.now(),
    });
    if (endSeconds >= duration) break;
    startSeconds += step;
  }

  return ranges;
}

export function createResumableTranscriptionJob(input: {
  manifest: LongMediaManifest;
  providerStatus: AutomaticTranscriptionProviderStatus;
  language?: string;
  requestSpeakerLabels: boolean;
  rangeSeconds?: number;
  overlapSeconds?: number;
}): ResumableTranscriptionJob {
  if (!input.manifest.durationSeconds || input.manifest.durationSeconds <= 0) {
    throw new Error(
      "The lecture duration is required before a resumable range queue can be created.",
    );
  }
  const requestedRangeSeconds = input.rangeSeconds ?? DEFAULT_RESUMABLE_RANGE_SECONDS;
  const requestedOverlapSeconds = input.overlapSeconds ?? DEFAULT_RESUMABLE_OVERLAP_SECONDS;
  const rangeSeconds = Math.max(60, Math.min(30 * 60, Math.round(requestedRangeSeconds)));
  const overlapSeconds = Math.max(0, Math.min(30, rangeSeconds / 4, requestedOverlapSeconds));
  const ranges = planResumableTranscriptionRanges(
    input.manifest.durationSeconds,
    rangeSeconds,
    overlapSeconds,
  );
  if (ranges.length === 0) throw new Error("No valid transcription ranges could be planned.");
  const now = Date.now();
  return {
    materialId: input.manifest.materialId,
    sourceUploadId: input.manifest.uploadId,
    durationSeconds: input.manifest.durationSeconds,
    provider: input.providerStatus.provider,
    providerDisplayName: input.providerStatus.displayName,
    model: input.providerStatus.model ?? "unknown",
    language: input.language || undefined,
    requestSpeakerLabels: input.requestSpeakerLabels,
    rangeSeconds,
    overlapSeconds,
    status: "planning",
    ranges,
    revision: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function recoverInterruptedResumableJob(
  job: ResumableTranscriptionJob,
): ResumableTranscriptionJob {
  const now = Date.now();
  const ranges = job.ranges.map((range) => {
    if (!["ready", "uploading", "processing"].includes(range.status)) return range;
    return {
      ...range,
      status: "needs_file" as const,
      uploadProgress: 0,
      error:
        "The browser no longer has this local clip. Select the same range clip again before retrying.",
      updatedAt: now,
    };
  });
  return finalizeJob({ ...job, ranges, updatedAt: now });
}

export function attachResumableRangeFile(
  job: ResumableTranscriptionJob,
  rangeId: string,
  file: Pick<File, "name" | "size" | "type">,
  maxBytes?: number,
): ResumableTranscriptionJob {
  const validation = validateAutomaticTranscriptionFile(file, maxBytes);
  if (!validation.ok) throw new Error(validation.message);
  return updateRange(job, rangeId, (range) => ({
    ...range,
    status: "ready",
    selectedFileName: file.name,
    selectedFileSize: file.size,
    selectedFileMimeType: file.type || "application/octet-stream",
    uploadProgress: 0,
    resultSegments: [],
    warnings: [],
    providerRequestId: undefined,
    error: undefined,
    updatedAt: Date.now(),
  }));
}

export function beginResumableRangeAttempt(
  job: ResumableTranscriptionJob,
  rangeId: string,
): ResumableTranscriptionJob {
  return updateRange(job, rangeId, (range) => {
    if (!range.selectedFileName || !range.selectedFileSize) {
      throw new Error("Select a provider-ready clip for this range before upload.");
    }
    return {
      ...range,
      status: "uploading",
      attempt: range.attempt + 1,
      uploadProgress: 0,
      resultSegments: [],
      warnings: [],
      providerRequestId: undefined,
      error: undefined,
      updatedAt: Date.now(),
    };
  });
}

export function updateResumableRangeProgress(
  job: ResumableTranscriptionJob,
  rangeId: string,
  fraction: number,
): ResumableTranscriptionJob {
  const uploadProgress = Math.max(0, Math.min(1, Number(fraction) || 0));
  return updateRange(job, rangeId, (range) => ({
    ...range,
    status: uploadProgress >= 1 ? "processing" : "uploading",
    uploadProgress,
    updatedAt: Date.now(),
  }));
}

export function completeResumableRangeAttempt(
  job: ResumableTranscriptionJob,
  rangeId: string,
  response: AutomaticTranscriptionResponse,
): ResumableTranscriptionJob {
  return updateRange(job, rangeId, (range) => {
    if (!response.ok || !response.segments?.length) {
      return {
        ...range,
        status: "failed",
        uploadProgress: 1,
        providerRequestId: response.requestId,
        warnings: response.warnings ?? [],
        error: response.error || "The provider returned no usable transcript segments.",
        updatedAt: Date.now(),
      };
    }
    const clipDuration = Math.max(0.01, range.endSeconds - range.startSeconds);
    const relative = normalizeAutomaticSegments(response.segments, clipDuration);
    const absolute = normalizeAutomaticSegments(
      relative.map((segment) => ({
        ...segment,
        id: `${range.id}:${segment.id}`,
        startSeconds: range.startSeconds + segment.startSeconds,
        endSeconds: range.startSeconds + segment.endSeconds,
      })),
      job.durationSeconds,
    ).filter(
      (segment) =>
        segment.endSeconds > range.startSeconds && segment.startSeconds < range.endSeconds + 0.01,
    );
    if (absolute.length === 0) {
      return {
        ...range,
        status: "failed",
        uploadProgress: 1,
        providerRequestId: response.requestId,
        warnings: response.warnings ?? [],
        error: "The provider result had no timestamped speech inside this range.",
        updatedAt: Date.now(),
      };
    }
    return {
      ...range,
      status: "review_ready",
      uploadProgress: 1,
      providerRequestId: response.requestId,
      resultSegments: absolute,
      warnings: response.warnings ?? [],
      error: undefined,
      updatedAt: Date.now(),
    };
  });
}

export function cancelResumableRangeAttempt(
  job: ResumableTranscriptionJob,
  rangeId: string,
  message = "The range request was cancelled by the user.",
): ResumableTranscriptionJob {
  return updateRange(job, rangeId, (range) => ({
    ...range,
    status: "cancelled",
    error: message,
    updatedAt: Date.now(),
  }));
}

export function mergeResumableTranscriptionSegments(
  job: ResumableTranscriptionJob,
): AutomaticTranscriptSegment[] {
  const candidates: RangeSegmentCandidate[] = job.ranges
    .filter((range) => range.status === "review_ready")
    .flatMap((range) =>
      range.resultSegments.map((segment) => ({
        rangeId: range.id,
        rangeStartSeconds: range.startSeconds,
        rangeEndSeconds: range.endSeconds,
        segment,
      })),
    )
    .sort(
      (left, right) =>
        left.segment.startSeconds - right.segment.startSeconds ||
        left.segment.endSeconds - right.segment.endSeconds,
    );
  const merged: RangeSegmentCandidate[] = [];

  for (const candidate of candidates) {
    const previous = merged.at(-1);
    if (previous && shouldMergeOverlap(previous, candidate, job.overlapSeconds)) {
      merged[merged.length - 1] = {
        ...previous,
        segment: {
          ...previous.segment,
          startSeconds: Math.min(previous.segment.startSeconds, candidate.segment.startSeconds),
          endSeconds: Math.max(previous.segment.endSeconds, candidate.segment.endSeconds),
          text: chooseMoreCompleteText(previous.segment.text, candidate.segment.text),
          speaker: previous.segment.speaker ?? candidate.segment.speaker,
          language: previous.segment.language ?? candidate.segment.language,
          uncertain: Boolean(previous.segment.uncertain || candidate.segment.uncertain),
          issues: Array.from(
            new Set([...(previous.segment.issues ?? []), ...(candidate.segment.issues ?? [])]),
          ),
        },
      };
      continue;
    }
    merged.push(candidate);
  }

  return normalizeAutomaticSegments(
    merged.map((candidate) => candidate.segment),
    job.durationSeconds,
  );
}

export function getResumableTranscriptionGaps(job: ResumableTranscriptionJob) {
  return findAutomaticTranscriptionGaps(
    mergeResumableTranscriptionSegments(job),
    job.durationSeconds,
  );
}

export function buildTranscriptDraftFromResumableJob(
  job: ResumableTranscriptionJob,
  manifest: LongMediaManifest,
  existing?: LongMediaTranscriptDraft,
): LongMediaTranscriptDraft {
  if (job.materialId !== manifest.materialId || job.sourceUploadId !== manifest.uploadId) {
    throw new Error("The range queue belongs to an older lecture upload.");
  }
  const merged = mergeResumableTranscriptionSegments(job);
  if (merged.length === 0) {
    throw new Error("No completed range contains usable transcript segments.");
  }
  const segments: TranscriptSegmentDraft[] = merged.map((segment, index) => ({
    id: `seg_range_${index}_${Math.round(segment.startSeconds * 1000)}`,
    startSeconds: segment.startSeconds,
    endSeconds: segment.endSeconds,
    text: segment.text,
    speaker: segment.speaker,
    language: segment.language ?? job.language,
    status: "draft",
  }));
  const now = Date.now();
  return {
    materialId: manifest.materialId,
    sourceUploadId: manifest.uploadId,
    segments,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

export function markResumableDraftLoaded(
  job: ResumableTranscriptionJob,
): ResumableTranscriptionJob {
  return { ...job, status: "draft_loaded", updatedAt: Date.now() };
}

export function unresolvedResumableRanges(job: ResumableTranscriptionJob) {
  return job.ranges.filter((range) => range.status !== "review_ready");
}

export function deriveResumableTranscriptionJobStatus(
  ranges: ResumableTranscriptionRange[],
  currentStatus?: ResumableTranscriptionJobStatus,
): ResumableTranscriptionJobStatus {
  if (currentStatus === "draft_loaded") return "draft_loaded";
  const statuses = ranges.map((range) => range.status);
  if (statuses.every((value) => value === "review_ready")) return "review_ready";
  if (statuses.some((value) => value === "uploading" || value === "processing")) return "running";
  if (statuses.some((value) => value === "ready")) return "ready";
  if (statuses.some((value) => value === "review_ready")) return "partial_ready";
  if (statuses.every((value) => value === "cancelled")) return "cancelled";
  if (statuses.every((value) => value === "needs_file")) return "planning";
  return "paused";
}

function updateRange(
  job: ResumableTranscriptionJob,
  rangeId: string,
  update: (range: ResumableTranscriptionRange) => ResumableTranscriptionRange,
): ResumableTranscriptionJob {
  let found = false;
  const ranges = job.ranges.map((range) => {
    if (range.id !== rangeId) return range;
    found = true;
    return update(range);
  });
  if (!found) throw new Error(`Unknown transcription range: ${rangeId}`);
  return finalizeJob({ ...job, ranges, updatedAt: Date.now() });
}

function finalizeJob(job: ResumableTranscriptionJob): ResumableTranscriptionJob {
  return {
    ...job,
    status: deriveResumableTranscriptionJobStatus(job.ranges, job.status),
    updatedAt: Date.now(),
  };
}

function shouldMergeOverlap(
  left: RangeSegmentCandidate,
  right: RangeSegmentCandidate,
  overlapSeconds: number,
): boolean {
  if (left.rangeId === right.rangeId) return false;
  const sharedStart = Math.max(left.rangeStartSeconds, right.rangeStartSeconds);
  const sharedEnd = Math.min(left.rangeEndSeconds, right.rangeEndSeconds);
  if (sharedEnd <= sharedStart) return false;
  if (sharedEnd - sharedStart > overlapSeconds + 0.01) return false;
  const tolerance = 1;
  const leftTouchesSharedRange =
    left.segment.endSeconds >= sharedStart - tolerance &&
    left.segment.startSeconds <= sharedEnd + tolerance;
  const rightTouchesSharedRange =
    right.segment.endSeconds >= sharedStart - tolerance &&
    right.segment.startSeconds <= sharedEnd + tolerance;
  if (!leftTouchesSharedRange || !rightTouchesSharedRange) return false;
  if (
    right.segment.startSeconds >
    left.segment.endSeconds + Math.max(tolerance, overlapSeconds + tolerance)
  ) {
    return false;
  }
  const leftText = normalizeText(left.segment.text);
  const rightText = normalizeText(right.segment.text);
  if (!leftText || !rightText) return false;
  return leftText === rightText || leftText.includes(rightText) || rightText.includes(leftText);
}

function chooseMoreCompleteText(left: string, right: string): string {
  return normalizeText(right).length > normalizeText(left).length ? right : left;
}

function normalizeText(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\p{P}\p{S}\s]+/gu, " ")
    .trim();
}
