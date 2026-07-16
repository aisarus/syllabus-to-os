import type {
  LongMediaManifest,
  LongMediaTranscriptDraft,
  TranscriptSegmentDraft,
} from "./long-media";

export const MAX_AUTOMATIC_TRANSCRIPTION_BYTES = 24 * 1024 * 1024;
export const AUTOMATIC_TRANSCRIPTION_PROMPT_VERSION = "long-media-transcription-v1";

export type AutomaticTranscriptionProvider = "openai-audio";
export type AutomaticTranscriptionJobStatus =
  | "awaiting_consent"
  | "uploading"
  | "processing"
  | "review_ready"
  | "draft_loaded"
  | "cancelled"
  | "failed";

export interface AutomaticTranscriptionProviderStatus {
  ok: boolean;
  provider: AutomaticTranscriptionProvider;
  displayName: string;
  configured: boolean;
  model: string | null;
  maxBytes: number;
  acceptedExtensions: string[];
  supportsSpeakerLabels: boolean;
  disclosure: string;
  error?: string;
}

export interface AutomaticTranscriptSegment {
  id: string;
  startSeconds: number;
  endSeconds: number;
  text: string;
  speaker?: string;
  language?: string;
  uncertain?: boolean;
  issues?: string[];
}

export interface AutomaticTranscriptionJob {
  materialId: string;
  sourceUploadId: string;
  provider: AutomaticTranscriptionProvider;
  providerDisplayName: string;
  model: string;
  status: AutomaticTranscriptionJobStatus;
  attempt: number;
  sourceFileName: string;
  sourceFileSize: number;
  sourceFileMimeType: string;
  usedProviderCopy: boolean;
  language?: string;
  requestSpeakerLabels: boolean;
  uploadProgress: number;
  resultSegments: AutomaticTranscriptSegment[];
  warnings: string[];
  providerRequestId?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AutomaticTranscriptionResponse {
  ok: boolean;
  provider?: AutomaticTranscriptionProvider;
  providerDisplayName?: string;
  model?: string;
  requestId?: string;
  language?: string;
  durationSeconds?: number;
  segments?: AutomaticTranscriptSegment[];
  warnings?: string[];
  error?: string;
  details?: string;
}

export interface AutomaticTranscriptionGap {
  startSeconds: number;
  endSeconds: number;
}

const ACCEPTED_EXTENSIONS = new Set([
  "flac",
  "mp3",
  "mp4",
  "mpeg",
  "mpga",
  "m4a",
  "ogg",
  "wav",
  "webm",
]);

export function extensionOfTranscriptionFile(name: string): string {
  return name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
}

export function validateAutomaticTranscriptionFile(
  file: Pick<File, "name" | "size">,
  maxBytes = MAX_AUTOMATIC_TRANSCRIPTION_BYTES,
): { ok: true } | { ok: false; reason: "empty" | "too_large" | "unsupported"; message: string } {
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return { ok: false, reason: "empty", message: "The transcription file is empty." };
  }
  if (file.size > maxBytes) {
    return {
      ok: false,
      reason: "too_large",
      message: `The transcription provider copy must be ${Math.floor(maxBytes / 1024 / 1024)} MB or smaller.`,
    };
  }
  if (!ACCEPTED_EXTENSIONS.has(extensionOfTranscriptionFile(file.name))) {
    return {
      ok: false,
      reason: "unsupported",
      message: "Use FLAC, MP3, MP4, MPEG, MPGA, M4A, OGG, WAV or WebM.",
    };
  }
  return { ok: true };
}

export function normalizeAutomaticSegments(
  segments: AutomaticTranscriptSegment[],
  durationSeconds?: number,
): AutomaticTranscriptSegment[] {
  const maxDuration =
    Number.isFinite(durationSeconds) && (durationSeconds ?? 0) > 0 ? durationSeconds : undefined;
  return segments
    .map((segment, index) => {
      const rawStart = Math.max(0, Number(segment.startSeconds) || 0);
      const startSeconds = maxDuration ? Math.min(maxDuration, rawStart) : rawStart;
      const rawEnd = Number(segment.endSeconds);
      const endSeconds = Math.max(
        startSeconds + 0.01,
        Number.isFinite(rawEnd) ? rawEnd : startSeconds + 1,
      );
      const boundedEnd = maxDuration ? Math.min(maxDuration, endSeconds) : endSeconds;
      return {
        ...segment,
        id: segment.id || `auto_${index}_${Math.round(startSeconds * 1000)}`,
        startSeconds,
        endSeconds: boundedEnd,
        text: segment.text.trim(),
        speaker: segment.speaker?.trim() || undefined,
        language: segment.language?.trim() || undefined,
        issues: Array.from(
          new Set((segment.issues ?? []).map((item) => item.trim()).filter(Boolean)),
        ),
      };
    })
    .filter(
      (segment) =>
        segment.text &&
        segment.endSeconds > segment.startSeconds &&
        (!maxDuration || segment.startSeconds < maxDuration),
    )
    .sort(
      (left, right) => left.startSeconds - right.startSeconds || left.endSeconds - right.endSeconds,
    );
}

export function findAutomaticTranscriptionGaps(
  segments: AutomaticTranscriptSegment[],
  durationSeconds: number | undefined,
  minimumGapSeconds = 8,
): AutomaticTranscriptionGap[] {
  if (!Number.isFinite(durationSeconds) || (durationSeconds ?? 0) <= 0) return [];
  const duration = durationSeconds as number;
  const normalized = normalizeAutomaticSegments(segments, duration);
  const gaps: AutomaticTranscriptionGap[] = [];
  let cursor = 0;
  for (const segment of normalized) {
    if (segment.startSeconds - cursor >= minimumGapSeconds) {
      gaps.push({ startSeconds: cursor, endSeconds: segment.startSeconds });
    }
    cursor = Math.max(cursor, segment.endSeconds);
  }
  if (duration - cursor >= minimumGapSeconds)
    gaps.push({ startSeconds: cursor, endSeconds: duration });
  return gaps;
}

export function buildTranscriptDraftFromAutomaticJob(
  job: AutomaticTranscriptionJob,
  manifest: LongMediaManifest,
  existing?: LongMediaTranscriptDraft,
): LongMediaTranscriptDraft {
  if (job.materialId !== manifest.materialId || job.sourceUploadId !== manifest.uploadId) {
    throw new Error("The automatic transcript belongs to an older lecture upload.");
  }
  if (job.status !== "review_ready" && job.status !== "draft_loaded") {
    throw new Error("The provider result is not ready for transcript review.");
  }
  const segments: TranscriptSegmentDraft[] = normalizeAutomaticSegments(
    job.resultSegments,
    manifest.durationSeconds,
  ).map((segment, index) => ({
    id: `seg_auto_${index}_${Math.round(segment.startSeconds * 1000)}`,
    startSeconds: segment.startSeconds,
    endSeconds: segment.endSeconds,
    text: segment.text,
    speaker: segment.speaker,
    language: segment.language ?? job.language,
    status: "draft",
  }));
  if (segments.length === 0)
    throw new Error("The provider returned no usable transcript segments.");
  const now = Date.now();
  return {
    materialId: manifest.materialId,
    sourceUploadId: manifest.uploadId,
    segments,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

export function beginAutomaticTranscriptionJob(input: {
  manifest: LongMediaManifest;
  providerStatus: AutomaticTranscriptionProviderStatus;
  file: Pick<File, "name" | "size" | "type">;
  usedProviderCopy: boolean;
  language?: string;
  requestSpeakerLabels: boolean;
  previous?: AutomaticTranscriptionJob;
}): AutomaticTranscriptionJob {
  const now = Date.now();
  return {
    materialId: input.manifest.materialId,
    sourceUploadId: input.manifest.uploadId,
    provider: input.providerStatus.provider,
    providerDisplayName: input.providerStatus.displayName,
    model: input.providerStatus.model ?? "unknown",
    status: "uploading",
    attempt: (input.previous?.attempt ?? 0) + 1,
    sourceFileName: input.file.name,
    sourceFileSize: input.file.size,
    sourceFileMimeType: input.file.type || "application/octet-stream",
    usedProviderCopy: input.usedProviderCopy,
    language: input.language || undefined,
    requestSpeakerLabels: input.requestSpeakerLabels,
    uploadProgress: 0,
    resultSegments: [],
    warnings: [],
    createdAt: input.previous?.createdAt ?? now,
    updatedAt: now,
  };
}

export async function getAutomaticTranscriptionProviderStatus(): Promise<AutomaticTranscriptionProviderStatus> {
  try {
    const response = await fetch("/api/ai/transcription-status", {
      headers: { Accept: "application/json" },
    });
    const payload = (await response.json()) as AutomaticTranscriptionProviderStatus;
    if (!response.ok) throw new Error(payload.error || String(response.status));
    return payload;
  } catch (error) {
    return {
      ok: false,
      provider: "openai-audio",
      displayName: "OpenAI Audio Transcriptions",
      configured: false,
      model: null,
      maxBytes: MAX_AUTOMATIC_TRANSCRIPTION_BYTES,
      acceptedExtensions: Array.from(ACCEPTED_EXTENSIONS),
      supportsSpeakerLabels: true,
      disclosure: "The selected provider copy is sent only after explicit consent.",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function requestAutomaticTranscription(input: {
  file: File;
  materialId: string;
  sourceUploadId: string;
  durationSeconds?: number;
  language?: string;
  requestSpeakerLabels: boolean;
  signal?: AbortSignal;
  onUploadProgress?: (fraction: number) => void;
}): Promise<AutomaticTranscriptionResponse> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    input.signal?.addEventListener("abort", abort, { once: true });
    xhr.open("POST", "/api/ai/transcribe-long-media");
    xhr.responseType = "json";
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) input.onUploadProgress?.(event.loaded / Math.max(1, event.total));
    };
    xhr.onload = () => {
      input.signal?.removeEventListener("abort", abort);
      const payload = (xhr.response ??
        safeParseResponse(xhr.responseText)) as AutomaticTranscriptionResponse;
      resolve(
        payload && typeof payload === "object"
          ? payload
          : { ok: false, error: `Transcription request failed (${xhr.status})` },
      );
    };
    xhr.onerror = () => {
      input.signal?.removeEventListener("abort", abort);
      resolve({ ok: false, error: "Transcription network request failed." });
    };
    xhr.onabort = () => {
      input.signal?.removeEventListener("abort", abort);
      resolve({ ok: false, error: "Transcription request cancelled." });
    };

    const body = new FormData();
    body.set("file", input.file, input.file.name);
    body.set("materialId", input.materialId);
    body.set("sourceUploadId", input.sourceUploadId);
    if (input.durationSeconds) body.set("durationSeconds", String(input.durationSeconds));
    if (input.language) body.set("language", input.language);
    body.set("requestSpeakerLabels", String(input.requestSpeakerLabels));
    xhr.send(body);
  });
}

function safeParseResponse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
