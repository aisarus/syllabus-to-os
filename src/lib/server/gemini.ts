// SERVER-ONLY. Do not import from client code.
// AI helpers used by /api/ai/* server routes.
//
// Uses the Lovable AI Gateway (free built-in AI, no user API key required).
// LOVABLE_API_KEY is auto-provisioned by Lovable and read only at request time.
//
// The exported names are kept as `Gemini*` for backward compatibility with
// existing callers, but the provider is the Lovable AI Gateway.

export const DEFAULT_GEMINI_MODEL = "google/gemini-3-flash-preview";
const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.LOVABLE_API_KEY && process.env.LOVABLE_API_KEY.trim());
}

export function getGeminiModelName(): string {
  const m = process.env.LOVABLE_AI_MODEL?.trim();
  return m && m.length > 0 ? m : DEFAULT_GEMINI_MODEL;
}

export type GeminiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; details?: string };

/**
 * Ask the Lovable AI Gateway for a strict-JSON response and parse it.
 * schemaDescription is included in the prompt as guidance for the model.
 */
export async function generateGeminiJSON<T = unknown>(
  prompt: string,
  schemaDescription: string,
): Promise<GeminiResult<T>> {
  const key = process.env.LOVABLE_API_KEY?.trim();
  if (!key) return { ok: false, error: "Lovable AI is not configured" };
  const model = getGeminiModelName();

  try {
    const res = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
        "X-Lovable-AIG-SDK": "custom-fetch",
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: `${prompt}\n\nReturn ONLY a strict JSON object. No markdown, no commentary.\n\nExpected schema (informal):\n${schemaDescription}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      if (res.status === 429) return { ok: false, error: "AI rate limit exceeded, try again later", details: errText.slice(0, 500) };
      if (res.status === 402) return { ok: false, error: "AI credits exhausted for this workspace", details: errText.slice(0, 500) };
      return { ok: false, error: `AI call failed (${res.status})`, details: errText.slice(0, 500) };
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = (data.choices?.[0]?.message?.content ?? "").trim();
    if (!text) return { ok: false, error: "Empty AI response" };

    const parsed = safeParseJSON(text);
    if (!parsed.ok) {
      return { ok: false, error: "AI returned invalid JSON", details: text.slice(0, 500) };
    }
    return { ok: true, data: parsed.value as T };
  } catch (e) {
    const msg = (e as Error).message || "AI call failed";
    return { ok: false, error: "AI call failed", details: msg };
  }
}

function safeParseJSON(text: string): { ok: true; value: unknown } | { ok: false } {
  const trimmed = text.trim();
  const attempts = [trimmed];
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) attempts.push(fence[1].trim());
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) attempts.push(trimmed.slice(first, last + 1));
  for (const a of attempts) {
    try {
      return { ok: true, value: JSON.parse(a) };
    } catch {
      /* try next */
    }
  }
  return { ok: false };
}
