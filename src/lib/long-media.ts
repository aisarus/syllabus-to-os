export const LONG_MEDIA_STORE_KEY = "lamdan.long-media.v1";
export const LONG_MEDIA_CHUNK_BYTES = 8 * 1024 * 1024;
export const MAX_LONG_MEDIA_BYTES = 4 * 1024 * 1024 * 1024;
export const DEFAULT_TRANSCRIPT_SEGMENT_SECONDS = 10 * 60;

export type LongMediaKind = "audio" | "video";
export type TranscriptSegmentStatus = "empty" | "draft" | "approved";

export interface LongMediaManifest {
  materialId: string;
  uploadId: string;
  fileName: string;
  mimeType: string;
  kind: LongMediaKind;
  size: number;
  chunkSize: number;
  chunkCount: number;
  durationSeconds?: number;
  createdAt: number;
  updatedAt: number;
}

export interface LongMediaChunkRecord {
  uploadId: string;
  materialId: string;
  index: number;
  size: number;
  sha256: string;
  blob: Blob;
  createdAt: number;
}

export interface TranscriptSegmentDraft {
  id: string;
  startSeconds: number;
  endSeconds: number;
  text: string;
  status: TranscriptSegmentStatus;
  speaker?: string;
  language?: string;
}

export interface LongMediaTranscriptDraft {
  materialId: string;
  sourceUploadId: string;
  segments: TranscriptSegmentDraft[];
  createdAt: number;
  updatedAt: number;
}

export interface LongMediaValidationResult {
  ok: boolean;
  kind?: LongMediaKind;
  message?: string;
}

const AUDIO_EXTENSIONS = ["mp3", "m4a", "aac", "wav", "ogg", "oga", "webm", "flac"];
const VIDEO_EXTENSIONS = ["mp4", "m4v", "mov", "webm", "mkv"];

function extensionOf(name: string): string {
  const match = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "";
}

export function detectLongMediaKind(file: Pick<File, "name" | "type">): LongMediaKind | undefined {
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("video/")) return "video";
  const extension = extensionOf(file.name);
  if (AUDIO_EXTENSIONS.includes(extension)) return "audio";
  if (VIDEO_EXTENSIONS.includes(extension)) return "video";
  return undefined;
}

export function validateLongMediaFile(
  file: Pick<File, "name" | "type" | "size">,
): LongMediaValidationResult {
  const kind = detectLongMediaKind(file);
  if (!kind) {
    return {
      ok: false,
      message: "Choose an audio or video lecture file (MP3, M4A, WAV, MP4, MOV or WebM).",
    };
  }
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return { ok: false, message: "The selected media file is empty." };
  }
  if (file.size > MAX_LONG_MEDIA_BYTES) {
    return { ok: false, message: "The local lecture-media limit is 4 GB per file." };
  }
  return { ok: true, kind };
}

export function buildTranscriptSegments(
  durationSeconds: number,
  segmentSeconds = DEFAULT_TRANSCRIPT_SEGMENT_SECONDS,
): TranscriptSegmentDraft[] {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return [];
  const boundedSegmentSeconds = Math.max(60, Math.min(30 * 60, Math.round(segmentSeconds)));
  const count = Math.max(1, Math.ceil(durationSeconds / boundedSegmentSeconds));
  return Array.from({ length: count }, (_, index) => {
    const startSeconds = index * boundedSegmentSeconds;
    const endSeconds = Math.min(durationSeconds, startSeconds + boundedSegmentSeconds);
    return {
      id: `seg_${index}_${Math.round(startSeconds)}`,
      startSeconds,
      endSeconds,
      text: "",
      status: "empty" as const,
    };
  });
}

export function formatMediaTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    : `${minutes}:${String(secs).padStart(2, "0")}`;
}

function parseTimestamp(value: string): number | undefined {
  const match = value.trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{2})(?:[,.](\d{1,3}))?$/);
  if (!match) return undefined;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const milliseconds = Number((match[4] ?? "0").padEnd(3, "0"));
  if ([hours, minutes, seconds, milliseconds].some((item) => !Number.isFinite(item))) return undefined;
  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
}

export function parseTimedTranscript(content: string): TranscriptSegmentDraft[] {
  const normalized = content.replace(/^WEBVTT[^\n]*\n+/i, "").replace(/\r/g, "");
  const blocks = normalized.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  const segments: TranscriptSegmentDraft[] = [];
  for (const block of blocks) {
    const lines = block.split("\n").map((line) => line.trimEnd());
    const timingIndex = lines.findIndex((line) => line.includes("-->"));
    if (timingIndex < 0) continue;
    const [startRaw, endWithSettings] = lines[timingIndex].split("-->").map((value) => value.trim());
    const endRaw = endWithSettings?.split(/\s+/)[0] ?? "";
    const startSeconds = parseTimestamp(startRaw);
    const endSeconds = parseTimestamp(endRaw);
    const text = lines.slice(timingIndex + 1).join("\n").trim();
    if (startSeconds === undefined || endSeconds === undefined || endSeconds <= startSeconds || !text) {
      continue;
    }
    segments.push({
      id: `seg_${segments.length}_${Math.round(startSeconds * 1000)}`,
      startSeconds,
      endSeconds,
      text,
      status: "draft",
    });
  }
  return segments;
}

export function transcriptToMaterialChunks(
  segments: TranscriptSegmentDraft[],
): Array<{ order: number; title: string; text: string; section: string }> {
  return segments
    .filter((segment) => segment.status === "approved" && segment.text.trim())
    .sort((a, b) => a.startSeconds - b.startSeconds)
    .map((segment, order) => {
      const label = `${formatMediaTime(segment.startSeconds)}–${formatMediaTime(segment.endSeconds)}`;
      return {
        order,
        title: label,
        section: `lecture-transcript:${Math.floor(segment.startSeconds)}-${Math.ceil(segment.endSeconds)}`,
        text: segment.text.trim(),
      };
    });
}
