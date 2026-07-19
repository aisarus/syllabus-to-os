// SERVER-ONLY. Do not import from client code.

export const DEFAULT_GEMINI_MODEL = "google/gemini-3-flash-preview";
const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const PROVIDER_TIMEOUT_MS = 45_000;
const MAX_PROVIDER_ATTEMPTS = 2;

export interface GeminiRequestOptions {
  signal?: AbortSignal;
  maxAttempts?: number;
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.LOVABLE_API_KEY && process.env.LOVABLE_API_KEY.trim());
}

export function getGeminiModelName(): string {
  const model = process.env.LOVABLE_AI_MODEL?.trim();
  return model && model.length > 0 ? model : DEFAULT_GEMINI_MODEL;
}

export type GeminiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; details?: string };

interface TextContentPart {
  type: "text";
  text: string;
}

interface ImageContentPart {
  type: "image_url";
  image_url: { url: string };
}

type UserContent = string | Array<TextContentPart | ImageContentPart>;

export async function generateGeminiJSON<T = unknown>(
  prompt: string,
  schemaDescription: string,
  options: GeminiRequestOptions = {},
): Promise<GeminiResult<T>> {
  return requestJSON<T>(
    `${prompt}\n\nReturn ONLY a strict JSON object. No markdown, no commentary.\n\nExpected schema (informal):\n${schemaDescription}`,
    options,
  );
}

export async function generateGeminiVisionJSON<T = unknown>(
  prompt: string,
  schemaDescription: string,
  imageDataUrl: string,
  options: GeminiRequestOptions = {},
): Promise<GeminiResult<T>> {
  if (!/^data:image\/(?:jpeg|png|webp);base64,/i.test(imageDataUrl)) {
    return { ok: false, error: "Unsupported image payload" };
  }
  return requestJSON<T>(
    [
      {
        type: "text",
        text: `${prompt}\n\nReturn ONLY a strict JSON object. No markdown, no commentary.\n\nExpected schema (informal):\n${schemaDescription}`,
      },
      { type: "image_url", image_url: { url: imageDataUrl } },
    ],
    options,
  );
}

async function requestJSON<T>(
  content: UserContent,
  options: GeminiRequestOptions,
): Promise<GeminiResult<T>> {
  const key = process.env.LOVABLE_API_KEY?.trim();
  if (!key) return { ok: false, error: "Lovable AI is not configured" };
  const attempts = Math.max(
    1,
    Math.min(MAX_PROVIDER_ATTEMPTS, options.maxAttempts ?? MAX_PROVIDER_ATTEMPTS),
  );

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const relayAbort = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener("abort", relayAbort, { once: true });
    const timeout = setTimeout(
      () => controller.abort(new Error("Provider request timeout")),
      PROVIDER_TIMEOUT_MS,
    );

    try {
      const response = await fetch(LOVABLE_AI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": key,
          "X-Lovable-AIG-SDK": "custom-fetch",
        },
        body: JSON.stringify({
          model: getGeminiModelName(),
          temperature: 0.1,
          response_format: { type: "json_object" },
          messages: [{ role: "user", content }],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const retryable = [429, 502, 503, 504].includes(response.status);
        if (retryable && attempt < attempts && !options.signal?.aborted) {
          await delay(250 * attempt, options.signal);
          continue;
        }
        if (response.status === 429) {
          return { ok: false, error: "AI rate limit exceeded, try again later" };
        }
        if (response.status === 402) {
          return { ok: false, error: "AI credits exhausted for this workspace" };
        }
        return {
          ok: false,
          error: `AI call failed (${response.status})`,
          details: `provider_status=${response.status}`,
        };
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = (data.choices?.[0]?.message?.content ?? "").trim();
      if (!text) return { ok: false, error: "Empty AI response" };
      const parsed = safeParseJSON(text);
      if (!parsed.ok) return { ok: false, error: "AI returned invalid JSON" };
      return { ok: true, data: parsed.value as T };
    } catch (error) {
      if (options.signal?.aborted) return { ok: false, error: "AI request cancelled" };
      if (controller.signal.aborted) return { ok: false, error: "AI request timed out" };
      if (attempt < attempts) {
        await delay(250 * attempt, options.signal);
        continue;
      }
      return {
        ok: false,
        error: "AI call failed",
        details: error instanceof Error ? error.name : "provider_network_error",
      };
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", relayAbort);
    }
  }
  return { ok: false, error: "AI call failed" };
}

async function delay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return;
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, milliseconds);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
  });
}

function safeParseJSON(text: string): { ok: true; value: unknown } | { ok: false } {
  const trimmed = text.trim();
  const attempts = [trimmed];
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) attempts.push(fence[1].trim());
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) attempts.push(trimmed.slice(first, last + 1));
  for (const attempt of attempts) {
    try {
      return { ok: true, value: JSON.parse(attempt) };
    } catch {
      // Try the next representation.
    }
  }
  return { ok: false };
}
