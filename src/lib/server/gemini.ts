// SERVER-ONLY. Do not import from client code.
// Google Gemini helpers used by /api/ai/* server routes.
//
// GEMINI_API_KEY is read only at request time.
// GEMINI_MODEL is optional (default gemini-2.5-flash).

import { GoogleGenAI } from "@google/genai";

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim());
}

export function getGeminiModelName(): string {
  const m = process.env.GEMINI_MODEL?.trim();
  return m && m.length > 0 ? m : DEFAULT_GEMINI_MODEL;
}

export type GeminiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; details?: string };

/**
 * Ask Gemini for a strict-JSON response and parse it.
 * schemaDescription is included in the prompt as guidance for the model.
 */
export async function generateGeminiJSON<T = unknown>(
  prompt: string,
  schemaDescription: string,
): Promise<GeminiResult<T>> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return { ok: false, error: "Gemini parser is not configured" };
  const model = getGeminiModelName();

  try {
    const ai = new GoogleGenAI({ apiKey: key });
    const res = await ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            { text: `${prompt}\n\nReturn ONLY a strict JSON object. No markdown, no commentary.\n\nExpected schema (informal):\n${schemaDescription}` },
          ],
        },
      ],
      config: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    });

    const text = (res.text ?? "").trim();
    if (!text) return { ok: false, error: "Empty Gemini response" };

    // Try direct parse, else strip code fences and parse first {...} block.
    const parsed = safeParseJSON(text);
    if (!parsed.ok) {
      return { ok: false, error: "Gemini returned invalid JSON", details: text.slice(0, 500) };
    }
    return { ok: true, data: parsed.value as T };
  } catch (e) {
    const msg = (e as Error).message || "Gemini call failed";
    return { ok: false, error: "Gemini call failed", details: msg };
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
