import { validateAutomaticTranscriptionFile } from "./automatic-transcription";

export const LOCAL_RANGE_EXTRACTION_TARGET_BITS_PER_SECOND = 160_000;
export const LOCAL_RANGE_EXTRACTION_DURATION_TOLERANCE_SECONDS = 1.5;
export const LOCAL_RANGE_EXTRACTION_SEEK_TOLERANCE_SECONDS = 0.25;
export const LOCAL_RANGE_EXTRACTION_STORAGE_MARGIN_BYTES = 32 * 1024 * 1024;

export const LOCAL_RANGE_EXTRACTION_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
] as const;

export interface LocalRangeExtractionIdentity {
  materialId: string;
  sourceUploadId: string;
  rangeId: string;
  startSeconds: number;
  endSeconds: number;
}

export interface LocalRangeExtractionProvenance extends LocalRangeExtractionIdentity {
  clipId: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  durationSeconds: number;
  estimatedBytes: number;
  wallTimeMilliseconds: number;
  mainThreadBusyMilliseconds?: number;
  createdAt: number;
}

export interface LocalRangeExtractionEstimate {
  durationSeconds: number;
  expectedBytes: number;
  temporaryStorageBytes: number;
  estimatedWallTimeSeconds: number;
  targetBitsPerSecond: number;
  maxBytes: number;
  ok: boolean;
  message?: string;
}

export interface LocalRangeExtractionCapability {
  supported: boolean;
  mediaElementCapture: boolean;
  mediaRecorder: boolean;
  mimeType?: string;
  reason?: string;
}

export interface LocalRangeExtractionBrowserFeatures {
  mediaElementCapture: boolean;
  mediaRecorder: boolean;
  isTypeSupported?: (mimeType: string) => boolean;
}

export type LocalRangeExtractionPromotionValidation =
  | { ok: true }
  | {
      ok: false;
      reason: "identity" | "duration" | "mime" | "provider_file";
      message: string;
    };

export function createLocalRangeExtractionIdentity(input: LocalRangeExtractionIdentity) {
  return {
    materialId: input.materialId,
    sourceUploadId: input.sourceUploadId,
    rangeId: input.rangeId,
    startSeconds: normalizeSeconds(input.startSeconds),
    endSeconds: normalizeSeconds(input.endSeconds),
  } satisfies LocalRangeExtractionIdentity;
}

export function selectLocalRangeExtractionMimeType(
  isTypeSupported?: (mimeType: string) => boolean,
): string | undefined {
  if (!isTypeSupported) return undefined;
  return LOCAL_RANGE_EXTRACTION_MIME_CANDIDATES.find((candidate) => isTypeSupported(candidate));
}

export function detectLocalRangeExtractionCapability(
  features: LocalRangeExtractionBrowserFeatures = getBrowserFeatures(),
): LocalRangeExtractionCapability {
  if (!features.mediaElementCapture) {
    return {
      supported: false,
      mediaElementCapture: false,
      mediaRecorder: features.mediaRecorder,
      reason: "This browser cannot capture a local media element. Choose a clip manually instead.",
    };
  }
  if (!features.mediaRecorder) {
    return {
      supported: false,
      mediaElementCapture: true,
      mediaRecorder: false,
      reason: "This browser cannot record a local media stream. Choose a clip manually instead.",
    };
  }
  const mimeType = selectLocalRangeExtractionMimeType(features.isTypeSupported);
  if (!mimeType) {
    return {
      supported: false,
      mediaElementCapture: true,
      mediaRecorder: true,
      reason:
        "This browser has no supported local audio recording format. Choose a clip manually instead.",
    };
  }
  return { supported: true, mediaElementCapture: true, mediaRecorder: true, mimeType };
}

export function estimateLocalRangeExtraction(input: {
  durationSeconds: number;
  maxBytes: number;
  targetBitsPerSecond?: number;
}): LocalRangeExtractionEstimate {
  const durationSeconds = Math.max(0, Number(input.durationSeconds) || 0);
  const maxBytes = Math.max(0, Number(input.maxBytes) || 0);
  const targetBitsPerSecond = Math.max(
    1,
    Math.round(input.targetBitsPerSecond ?? LOCAL_RANGE_EXTRACTION_TARGET_BITS_PER_SECOND),
  );
  const encodedBytes = Math.ceil((durationSeconds * targetBitsPerSecond) / 8);
  const expectedBytes = Math.ceil(encodedBytes * 1.15 + 64 * 1024);
  const temporaryStorageBytes = expectedBytes + LOCAL_RANGE_EXTRACTION_STORAGE_MARGIN_BYTES;
  if (durationSeconds <= 0) {
    return {
      durationSeconds,
      expectedBytes,
      temporaryStorageBytes,
      estimatedWallTimeSeconds: durationSeconds,
      targetBitsPerSecond,
      maxBytes,
      ok: false,
      message: "The selected range has no positive duration.",
    };
  }
  if (expectedBytes > maxBytes) {
    return {
      durationSeconds,
      expectedBytes,
      temporaryStorageBytes,
      estimatedWallTimeSeconds: durationSeconds,
      targetBitsPerSecond,
      maxBytes,
      ok: false,
      message: "The conservative local recording estimate exceeds the provider file limit.",
    };
  }
  return {
    durationSeconds,
    expectedBytes,
    temporaryStorageBytes,
    estimatedWallTimeSeconds: durationSeconds,
    targetBitsPerSecond,
    maxBytes,
    ok: true,
  };
}

/**
 * Prefer duration from the finished container, but never substitute the requested
 * range itself when a recorder-produced WebM omits that metadata. In that narrow
 * browser case, the caller may use the independently observed source-playback
 * span from the 1× capture session instead.
 */
export function selectLocalRangeExtractionDurationEvidence(input: {
  containerDurationSeconds?: number;
  capturedDurationSeconds?: number;
}): number | undefined {
  if (
    Number.isFinite(input.containerDurationSeconds) &&
    (input.containerDurationSeconds ?? 0) > 0
  ) {
    return input.containerDurationSeconds;
  }
  if (Number.isFinite(input.capturedDurationSeconds) && (input.capturedDurationSeconds ?? 0) > 0) {
    return input.capturedDurationSeconds;
  }
  return undefined;
}

export function createLocalRangeExtractionFileName(
  sourceFileName: string,
  identity: Pick<LocalRangeExtractionIdentity, "startSeconds" | "endSeconds">,
): string {
  const stem = sourceFileName.replace(/\.[a-z0-9]+$/i, "") || "lecture";
  const start = Math.round(Math.max(0, identity.startSeconds) * 1000);
  const end = Math.round(Math.max(0, identity.endSeconds) * 1000);
  return `${stem}-range-${start}-${end}.webm`;
}

export function validateLocalRangeExtractionPromotion(input: {
  expected: LocalRangeExtractionIdentity;
  provenance: LocalRangeExtractionIdentity;
  file: Pick<File, "name" | "size" | "type">;
  actualDurationSeconds: number;
  maxBytes: number;
}): LocalRangeExtractionPromotionValidation {
  if (!sameLocalRangeExtractionIdentity(input.expected, input.provenance)) {
    return {
      ok: false,
      reason: "identity",
      message: "The extracted clip no longer matches this persisted lecture range.",
    };
  }
  const expectedDuration = input.expected.endSeconds - input.expected.startSeconds;
  if (
    !Number.isFinite(input.actualDurationSeconds) ||
    input.actualDurationSeconds <= 0 ||
    Math.abs(input.actualDurationSeconds - expectedDuration) >
      LOCAL_RANGE_EXTRACTION_DURATION_TOLERANCE_SECONDS
  ) {
    return {
      ok: false,
      reason: "duration",
      message: "The local recording duration does not match the requested lecture range.",
    };
  }
  const normalizedMime = normalizeLocalRangeExtractionMimeType(input.file.type);
  if (normalizedMime !== "audio/webm") {
    return {
      ok: false,
      reason: "mime",
      message: "The local recording did not produce a supported audio MIME type.",
    };
  }
  const providerFileValidation = validateAutomaticTranscriptionFile(input.file, input.maxBytes);
  if (!providerFileValidation.ok) {
    return {
      ok: false,
      reason: "provider_file",
      message: providerFileValidation.message,
    };
  }
  return { ok: true };
}

export function sameLocalRangeExtractionIdentity(
  left: LocalRangeExtractionIdentity,
  right: LocalRangeExtractionIdentity,
): boolean {
  return (
    left.materialId === right.materialId &&
    left.sourceUploadId === right.sourceUploadId &&
    left.rangeId === right.rangeId &&
    Math.abs(left.startSeconds - right.startSeconds) < 0.001 &&
    Math.abs(left.endSeconds - right.endSeconds) < 0.001
  );
}

export function normalizeLocalRangeExtractionMimeType(
  value: string | undefined,
): string | undefined {
  const normalized = value?.split(";", 1)[0]?.trim().toLowerCase();
  return normalized || undefined;
}

function normalizeSeconds(value: number): number {
  return Math.max(0, Number.isFinite(value) ? value : 0);
}

function getBrowserFeatures(): LocalRangeExtractionBrowserFeatures {
  const mediaElementCapture =
    typeof HTMLMediaElement !== "undefined" &&
    (typeof (HTMLMediaElement.prototype as CapturableMediaElement).captureStream === "function" ||
      typeof (HTMLMediaElement.prototype as CapturableMediaElement).mozCaptureStream ===
        "function");
  const mediaRecorder = typeof MediaRecorder !== "undefined";
  return {
    mediaElementCapture,
    mediaRecorder,
    isTypeSupported: mediaRecorder ? MediaRecorder.isTypeSupported.bind(MediaRecorder) : undefined,
  };
}

interface CapturableMediaElement extends HTMLMediaElement {
  captureStream?: () => MediaStream;
  mozCaptureStream?: () => MediaStream;
}
