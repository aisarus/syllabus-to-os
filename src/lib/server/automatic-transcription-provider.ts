import { currentAIProviderSignal } from "./ai-provider-signal-context.ts";
import {
  MAX_AUTOMATIC_TRANSCRIPTION_BYTES,
  normalizeAutomaticSegments,
  type AutomaticTranscriptSegment,
  type AutomaticTranscriptionProviderStatus,
} from "../automatic-transcription";

const DEFAULT_URL = "https://api.openai.com/v1/audio/transcriptions";
const DEFAULT_PLAIN_MODEL = "whisper-1";
const DEFAULT_SPEAKER_MODEL = "gpt-4o-transcribe-diarize";
const PROVIDER_DISPLAY_NAME = "OpenAI Audio Transcriptions";
const ACCEPTED_EXTENSIONS = ["flac", "mp3", "mp4", "mpeg", "mpga", "m4a", "ogg", "wav", "webm"];

interface ProviderSegment {
  id?: string | number;
  start?: number;
  end?: number;
  text?: string;
  speaker?: string;
  avg_logprob?: number;
  compression_ratio?: number;
  no_speech_prob?: number;
}

interface ProviderPayload {
  text?: string;
  language?: string;
  duration?: number;
  segments?: ProviderSegment[];
  error?: { message?: string } | string;
}

export interface AutomaticTranscriptionProviderResult {
  ok: boolean;
  provider: "openai-audio";
  providerDisplayName: string;
  model: string;
  requestId?: string;
  language?: string;
  durationSeconds?: number;
  segments: AutomaticTranscriptSegment[];
  warnings: string[];
  error?: string;
  details?: string;
}

export function getAutomaticTranscriptionProviderStatus(): AutomaticTranscriptionProviderStatus & {
  plainModel: string;
  speakerModel: string;
} {
  const key = process.env.OPENAI_API_KEY?.trim();
  return {
    ok: true,
    provider: "openai-audio",
    displayName: PROVIDER_DISPLAY_NAME,
    configured: Boolean(key),
    model: getSpeakerModel(),
    plainModel: getPlainModel(),
    speakerModel: getSpeakerModel(),
    maxBytes: MAX_AUTOMATIC_TRANSCRIPTION_BYTES,
    acceptedExtensions: ACCEPTED_EXTENSIONS,
    supportsSpeakerLabels: true,
    disclosure:
      "After explicit consent, the selected provider copy is sent through the Lamdan server to OpenAI's Audio Transcriptions API. Lamdan does not persist the request body on its server; provider handling depends on the configured API account and provider terms.",
  };
}

export async function transcribeWithConfiguredProvider(input: {
  file: File;
  language?: string;
  requestSpeakerLabels: boolean;
  durationSeconds?: number;
  signal?: AbortSignal;
}): Promise<AutomaticTranscriptionProviderResult> {
  const key = process.env.OPENAI_API_KEY?.trim();
  const model = input.requestSpeakerLabels ? getSpeakerModel() : getPlainModel();
  if (!key) {
    return failure(model, "OpenAI transcription is not configured on this deployment.");
  }
  if (input.file.size <= 0 || input.file.size > MAX_AUTOMATIC_TRANSCRIPTION_BYTES) {
    return failure(
      model,
      `Provider-ready media must be ${Math.floor(MAX_AUTOMATIC_TRANSCRIPTION_BYTES / 1024 / 1024)} MB or smaller.`,
    );
  }
  if (!ACCEPTED_EXTENSIONS.includes(extensionOf(input.file.name))) {
    return failure(
      model,
      `Unsupported transcription file type: ${extensionOf(input.file.name) || "none"}`,
    );
  }

  const form = new FormData();
  form.set("file", input.file, input.file.name);
  form.set("model", model);
  form.set("temperature", "0");
  if (input.language && /^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(input.language)) {
    form.set("language", input.language.slice(0, 2).toLowerCase());
  }
  if (input.requestSpeakerLabels) {
    form.set("response_format", "diarized_json");
    form.set("chunking_strategy", "auto");
  } else if (model === "whisper-1") {
    form.set("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "segment");
  } else {
    form.set("response_format", "json");
  }

  try {
    const response = await fetch(getProviderUrl(), {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal: currentAIProviderSignal() ?? input.signal,
    });
    const requestId = response.headers.get("x-request-id") ?? undefined;
    const rawText = await response.text();
    const parsed = safeParseJSON(rawText) as ProviderPayload | undefined;
    if (!response.ok) {
      const providerMessage =
        typeof parsed?.error === "string"
          ? parsed.error
          : parsed?.error?.message || rawText.slice(0, 500);
      return failure(
        model,
        `Transcription provider failed (${response.status}).`,
        providerMessage,
        requestId,
      );
    }
    if (!parsed || typeof parsed !== "object") {
      return failure(
        model,
        "The transcription provider returned invalid JSON.",
        rawText.slice(0, 500),
        requestId,
      );
    }

    const durationSeconds =
      positiveNumber(parsed.duration) ?? positiveNumber(input.durationSeconds);
    const warnings: string[] = [];
    let segments = normalizeProviderSegments(
      parsed.segments ?? [],
      parsed.language ?? input.language,
    );
    if (segments.length === 0 && parsed.text?.trim()) {
      warnings.push(
        "The selected model returned text without timestamp segments; Lamdan created one full-range draft block.",
      );
      segments = [
        {
          id: "provider_full_text",
          startSeconds: 0,
          endSeconds: durationSeconds ?? 1,
          text: parsed.text.trim(),
          language: parsed.language ?? input.language,
          uncertain: true,
          issues: ["Provider response did not include segment timestamps."],
        },
      ];
    }
    segments = normalizeAutomaticSegments(segments, durationSeconds);
    if (segments.length === 0) {
      return failure(
        model,
        "The transcription provider returned no usable speech segments.",
        undefined,
        requestId,
      );
    }
    if (segments.some((segment) => segment.uncertain)) {
      warnings.push("Some provider segments are marked uncertain and require careful review.");
    }

    return {
      ok: true,
      provider: "openai-audio",
      providerDisplayName: PROVIDER_DISPLAY_NAME,
      model,
      requestId,
      language: parsed.language ?? input.language,
      durationSeconds,
      segments,
      warnings,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return failure(model, "Transcription request cancelled.");
    }
    return failure(
      model,
      "Could not reach the transcription provider.",
      error instanceof Error ? error.message : String(error),
    );
  }
}

function normalizeProviderSegments(
  rawSegments: ProviderSegment[],
  language?: string,
): AutomaticTranscriptSegment[] {
  return rawSegments.map((segment, index) => {
    const issues: string[] = [];
    if (typeof segment.avg_logprob === "number" && segment.avg_logprob < -1) {
      issues.push("Low average token confidence.");
    }
    if (typeof segment.no_speech_prob === "number" && segment.no_speech_prob > 0.6) {
      issues.push("Provider detected a high probability of no speech.");
    }
    if (typeof segment.compression_ratio === "number" && segment.compression_ratio > 2.4) {
      issues.push("Provider compression-ratio quality warning.");
    }
    return {
      id: String(segment.id ?? `provider_${index}`),
      startSeconds: positiveNumber(segment.start) ?? 0,
      endSeconds: positiveNumber(segment.end) ?? (positiveNumber(segment.start) ?? 0) + 1,
      text: segment.text?.trim() ?? "",
      speaker: segment.speaker?.trim() || undefined,
      language,
      uncertain: issues.length > 0,
      issues,
    };
  });
}

function failure(
  model: string,
  error: string,
  details?: string,
  requestId?: string,
): AutomaticTranscriptionProviderResult {
  return {
    ok: false,
    provider: "openai-audio",
    providerDisplayName: PROVIDER_DISPLAY_NAME,
    model,
    requestId,
    segments: [],
    warnings: [],
    error,
    details,
  };
}

function getProviderUrl(): string {
  return process.env.OPENAI_TRANSCRIPTION_URL?.trim() || DEFAULT_URL;
}

function getPlainModel(): string {
  return process.env.OPENAI_TRANSCRIPTION_MODEL?.trim() || DEFAULT_PLAIN_MODEL;
}

function getSpeakerModel(): string {
  return process.env.OPENAI_TRANSCRIPTION_DIARIZE_MODEL?.trim() || DEFAULT_SPEAKER_MODEL;
}

function extensionOf(name: string): string {
  return name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
}

function positiveNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

function safeParseJSON(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}
