// SERVER-ONLY. Do not import from client code.
import {
  GEMINI_TRANSCRIPTION_MAX_BYTES,
  GEMINI_TRANSCRIPTION_PROVIDER,
  GEMINI_TRANSCRIPTION_PROVIDER_NAME,
  GEMINI_TRANSCRIPTION_RETENTION_HOURS,
  type ProviderTranscriptionRangeResult,
  type ProviderTranscriptSegment,
} from "../long-media-transcription";

const GEMINI_API_HOST = "generativelanguage.googleapis.com";
const GEMINI_UPLOAD_START_URL = `https://${GEMINI_API_HOST}/upload/v1beta/files`;
const GEMINI_API_BASE = `https://${GEMINI_API_HOST}/v1beta`;
const DEFAULT_TRANSCRIPTION_MODEL = "gemini-2.5-flash";

export interface GeminiTranscriptionStatus {
  configured: boolean;
  provider: typeof GEMINI_TRANSCRIPTION_PROVIDER;
  providerName: typeof GEMINI_TRANSCRIPTION_PROVIDER_NAME;
  model: string;
  maxFileBytes: number;
  retentionHours: number;
  supportsResumableUpload: true;
  sendsRecordingExternally: true;
}

export interface StartGeminiUploadInput {
  fileName: string;
  mimeType: string;
  size: number;
}

export interface GeminiUploadSession {
  uploadUrl: string;
  expiresWithProcess: true;
}

export interface UploadGeminiChunkInput {
  uploadUrl: string;
  offset: number;
  command: "upload" | "upload, finalize";
  body: ArrayBuffer;
}

export interface GeminiUploadedFile {
  name: string;
  uri: string;
  mimeType: string;
  sizeBytes?: number;
  state?: string;
}

export interface GeminiRangeInput {
  jobId: string;
  rangeId: string;
  providerFileName: string;
  providerFileUri: string;
  mimeType: string;
  startSeconds: number;
  endSeconds: number;
  languageHint?: string;
}

export type GeminiTranscriptionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; details?: string; status?: number };

export function getGeminiTranscriptionStatus(): GeminiTranscriptionStatus {
  return {
    configured: Boolean(getApiKey()),
    provider: GEMINI_TRANSCRIPTION_PROVIDER,
    providerName: GEMINI_TRANSCRIPTION_PROVIDER_NAME,
    model: getModel(),
    maxFileBytes: GEMINI_TRANSCRIPTION_MAX_BYTES,
    retentionHours: GEMINI_TRANSCRIPTION_RETENTION_HOURS,
    supportsResumableUpload: true,
    sendsRecordingExternally: true,
  };
}

export async function startGeminiResumableUpload(
  input: StartGeminiUploadInput,
): Promise<GeminiTranscriptionResult<GeminiUploadSession>> {
  const key = getApiKey();
  if (!key) return notConfigured();
  if (!input.fileName.trim() || !input.mimeType.trim()) {
    return { ok: false, error: "File name and MIME type are required.", status: 400 };
  }
  if (!Number.isFinite(input.size) || input.size <= 0 || input.size > GEMINI_TRANSCRIPTION_MAX_BYTES) {
    return {
      ok: false,
      error: "The transcription provider accepts a positive file size up to 2 GB.",
      status: 400,
    };
  }

  try {
    const response = await fetch(`${GEMINI_UPLOAD_START_URL}?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(input.size),
        "X-Goog-Upload-Header-Content-Type": input.mimeType,
      },
      body: JSON.stringify({ file: { display_name: input.fileName } }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) return providerFailure(response, "Could not start Gemini upload");
    const uploadUrl = response.headers.get("x-goog-upload-url");
    if (!uploadUrl || !isAllowedGeminiUploadUrl(uploadUrl)) {
      return { ok: false, error: "Gemini returned an invalid resumable upload URL." };
    }
    return { ok: true, data: { uploadUrl, expiresWithProcess: true } };
  } catch (error) {
    return caughtFailure(error, "Could not start Gemini upload");
  }
}

export async function uploadGeminiChunk(
  input: UploadGeminiChunkInput,
): Promise<GeminiTranscriptionResult<{ file?: GeminiUploadedFile; nextOffset: number }>> {
  if (!getApiKey()) return notConfigured();
  if (!isAllowedGeminiUploadUrl(input.uploadUrl)) {
    return { ok: false, error: "Rejected untrusted resumable upload URL.", status: 400 };
  }
  if (!Number.isSafeInteger(input.offset) || input.offset < 0) {
    return { ok: false, error: "Upload offset must be a non-negative integer.", status: 400 };
  }
  if (input.body.byteLength <= 0 || input.body.byteLength > 16 * 1024 * 1024) {
    return { ok: false, error: "Upload chunks must be between 1 byte and 16 MB.", status: 400 };
  }

  try {
    const response = await fetch(input.uploadUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "X-Goog-Upload-Offset": String(input.offset),
        "X-Goog-Upload-Command": input.command,
      },
      body: input.body,
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) return providerFailure(response, "Gemini chunk upload failed");
    const nextOffset = input.offset + input.body.byteLength;
    if (input.command !== "upload, finalize") {
      return { ok: true, data: { nextOffset } };
    }
    const payload = (await response.json().catch(() => null)) as
      | { file?: Record<string, unknown> }
      | null;
    const file = normalizeUploadedFile(payload?.file);
    if (!file) return { ok: false, error: "Gemini finalized the upload without a usable file." };
    return { ok: true, data: { nextOffset, file } };
  } catch (error) {
    return caughtFailure(error, "Gemini chunk upload failed");
  }
}

export async function transcribeGeminiRange(
  input: GeminiRangeInput,
): Promise<GeminiTranscriptionResult<ProviderTranscriptionRangeResult>> {
  const key = getApiKey();
  if (!key) return notConfigured();
  if (!isAllowedGeminiFileName(input.providerFileName) || !isAllowedGeminiFileUri(input.providerFileUri)) {
    return { ok: false, error: "Rejected invalid Gemini file reference.", status: 400 };
  }
  if (
    !Number.isFinite(input.startSeconds) ||
    !Number.isFinite(input.endSeconds) ||
    input.startSeconds < 0 ||
    input.endSeconds <= input.startSeconds ||
    input.endSeconds - input.startSeconds > 30 * 60
  ) {
    return { ok: false, error: "Transcription range must be between 1 second and 30 minutes.", status: 400 };
  }

  const prompt = buildRangePrompt(input);
  try {
    const response = await fetch(
      `${GEMINI_API_BASE}/models/${encodeURIComponent(getModel())}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { file_data: { mime_type: input.mimeType, file_uri: input.providerFileUri } },
                { text: prompt },
              ],
            },
          ],
          generationConfig: {
            temperature: 0,
            responseMimeType: "application/json",
          },
        }),
        signal: AbortSignal.timeout(180_000),
      },
    );
    if (!response.ok) return providerFailure(response, "Gemini transcription failed");
    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim();
    if (!text) return { ok: false, error: "Gemini returned an empty transcription response." };
    const parsed = parseJSON(text);
    const normalized = normalizeRangePayload(parsed, input);
    if (!normalized.ok) return normalized;
    return { ok: true, data: normalized.data };
  } catch (error) {
    return caughtFailure(error, "Gemini transcription failed");
  }
}

export async function deleteGeminiFile(
  fileName: string,
): Promise<GeminiTranscriptionResult<{ deleted: true }>> {
  const key = getApiKey();
  if (!key) return notConfigured();
  if (!isAllowedGeminiFileName(fileName)) {
    return { ok: false, error: "Rejected invalid Gemini file name.", status: 400 };
  }
  try {
    const response = await fetch(
      `${GEMINI_API_BASE}/${fileName}?key=${encodeURIComponent(key)}`,
      { method: "DELETE", signal: AbortSignal.timeout(30_000) },
    );
    if (!response.ok && response.status !== 404) {
      return providerFailure(response, "Could not delete Gemini file");
    }
    return { ok: true, data: { deleted: true } };
  } catch (error) {
    return caughtFailure(error, "Could not delete Gemini file");
  }
}

export function isAllowedGeminiUploadUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === GEMINI_API_HOST &&
      url.pathname.startsWith("/upload/v1beta/files")
    );
  } catch {
    return false;
  }
}

function isAllowedGeminiFileName(value: string): boolean {
  return /^files\/[A-Za-z0-9_-]+$/.test(value);
}

function isAllowedGeminiFileUri(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === GEMINI_API_HOST;
  } catch {
    return false;
  }
}

function getApiKey(): string | undefined {
  const key = process.env.GEMINI_API_KEY?.trim();
  return key || undefined;
}

function getModel(): string {
  return process.env.GEMINI_TRANSCRIPTION_MODEL?.trim() || DEFAULT_TRANSCRIPTION_MODEL;
}

function notConfigured<T>(): GeminiTranscriptionResult<T> {
  return {
    ok: false,
    error: "Google Gemini transcription is not configured on this deployment.",
    status: 503,
  };
}

async function providerFailure<T>(
  response: Response,
  message: string,
): Promise<GeminiTranscriptionResult<T>> {
  const details = (await response.text().catch(() => "")).slice(0, 1000);
  return {
    ok: false,
    error: `${message} (${response.status})`,
    details,
    status: response.status >= 500 ? 502 : response.status,
  };
}

function caughtFailure<T>(error: unknown, message: string): GeminiTranscriptionResult<T> {
  return {
    ok: false,
    error: message,
    details: error instanceof Error ? error.message : String(error),
    status: 502,
  };
}

function normalizeUploadedFile(value: Record<string, unknown> | undefined): GeminiUploadedFile | undefined {
  if (!value) return undefined;
  const name = typeof value.name === "string" ? value.name : "";
  const uri = typeof value.uri === "string" ? value.uri : "";
  const mimeType =
    typeof value.mimeType === "string"
      ? value.mimeType
      : typeof value.mime_type === "string"
        ? value.mime_type
        : "application/octet-stream";
  if (!isAllowedGeminiFileName(name) || !isAllowedGeminiFileUri(uri)) return undefined;
  const rawSize = value.sizeBytes ?? value.size_bytes;
  const sizeBytes = typeof rawSize === "string" ? Number(rawSize) : Number(rawSize);
  return {
    name,
    uri,
    mimeType,
    sizeBytes: Number.isFinite(sizeBytes) ? sizeBytes : undefined,
    state: typeof value.state === "string" ? value.state : undefined,
  };
}

function buildRangePrompt(input: GeminiRangeInput): string {
  return `Transcribe ONLY audible speech from ${input.startSeconds.toFixed(3)}s through ${input.endSeconds.toFixed(3)}s of the attached lecture.
Do not summarize. Do not infer missing words from general knowledge. Do not include speech outside this range.
Use the original spoken language${input.languageHint ? ` (likely ${input.languageHint})` : ""}.
Return strict JSON with this shape:
{
  "segments": [
    {
      "startSeconds": number,
      "endSeconds": number,
      "text": string,
      "speaker": string | null,
      "language": string | null,
      "unclear": boolean
    }
  ],
  "missingIntervals": [
    { "startSeconds": number, "endSeconds": number, "reason": string }
  ]
}
Timestamps must be absolute seconds from the beginning of the complete recording. Mark uncertain speech with unclear=true. Put silence, unintelligible audio or missing coverage into missingIntervals instead of inventing text.`;
}

function parseJSON(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const attempts = [trimmed, fence].filter((item): item is string => Boolean(item));
  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt);
    } catch {
      // Try the next representation.
    }
  }
  return undefined;
}

function normalizeRangePayload(
  value: unknown,
  input: GeminiRangeInput,
): GeminiTranscriptionResult<ProviderTranscriptionRangeResult> {
  if (!value || typeof value !== "object") {
    return { ok: false, error: "Gemini returned invalid transcription JSON." };
  }
  const payload = value as { segments?: unknown; missingIntervals?: unknown };
  const segments = Array.isArray(payload.segments)
    ? payload.segments.map(normalizeSegment).filter((item): item is ProviderTranscriptSegment => Boolean(item))
    : [];
  const missingIntervals = Array.isArray(payload.missingIntervals)
    ? payload.missingIntervals
        .map(normalizeMissingInterval)
        .filter((item): item is { startSeconds: number; endSeconds: number; reason: string } => Boolean(item))
    : [];
  return {
    ok: true,
    data: {
      provider: GEMINI_TRANSCRIPTION_PROVIDER,
      jobId: input.jobId,
      rangeId: input.rangeId,
      startSeconds: input.startSeconds,
      endSeconds: input.endSeconds,
      segments,
      missingIntervals,
    },
  };
}

function normalizeSegment(value: unknown): ProviderTranscriptSegment | undefined {
  if (!value || typeof value !== "object") return undefined;
  const segment = value as Record<string, unknown>;
  const startSeconds = Number(segment.startSeconds);
  const endSeconds = Number(segment.endSeconds);
  if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds) || endSeconds <= startSeconds) {
    return undefined;
  }
  return {
    startSeconds,
    endSeconds,
    text: typeof segment.text === "string" ? segment.text : "",
    speaker: typeof segment.speaker === "string" ? segment.speaker : undefined,
    language: typeof segment.language === "string" ? segment.language : undefined,
    unclear: Boolean(segment.unclear),
  };
}

function normalizeMissingInterval(
  value: unknown,
): { startSeconds: number; endSeconds: number; reason: string } | undefined {
  if (!value || typeof value !== "object") return undefined;
  const interval = value as Record<string, unknown>;
  const startSeconds = Number(interval.startSeconds);
  const endSeconds = Number(interval.endSeconds);
  if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds) || endSeconds <= startSeconds) {
    return undefined;
  }
  return {
    startSeconds,
    endSeconds,
    reason:
      typeof interval.reason === "string" && interval.reason.trim()
        ? interval.reason.trim()
        : "Unclear or missing audio in this interval.",
  };
}
