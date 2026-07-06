// AI provider abstraction.
// Real AI generation is not connected in the frontend.
// A single optional feature — Gemini-assisted syllabus parsing — is available via
// the `/api/ai/parse-syllabus` server route. The frontend never sees the API key.
// If GEMINI_API_KEY is not set on the server, the endpoint responds honestly and
// the UI stays disabled.

import type { Material } from "./store";
import type { ParsedSyllabusDraft, IgnoredRow } from "./syllabus-parser";

export type AIResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "not_connected" | "error"; message: string };

const NOT_CONNECTED_EN =
  "AI generation is not connected yet. Use the manual tools available on this screen.";
const NOT_CONNECTED_RU =
  "AI-генерация ещё не подключена. Используйте ручные инструменты на этом экране.";

export function notConnectedMessage(lang: "ru" | "en" = "ru") {
  return lang === "ru" ? NOT_CONNECTED_RU : NOT_CONNECTED_EN;
}

// Frontend-side heuristic: assume not connected. Real status is fetched from the
// server via `checkAIStatus()` when the UI needs to know.
export function isAIConnected(): boolean {
  return false;
}

function notConnected<T>(): AIResult<T> {
  return { ok: false, reason: "not_connected", message: NOT_CONNECTED_EN };
}

export async function generateNoteFromMaterial(_m: Material): Promise<AIResult<{ title: string; content: string }>> {
  return notConnected();
}
export async function generateQuizFromMaterial(_m: Material): Promise<
  AIResult<{ title: string; questions: { prompt: string; options: string[]; correctIndex: number; explanation?: string }[] }>
> { return notConnected(); }
export async function generateFlashcardsFromMaterial(_m: Material): Promise<AIResult<{ front: string; back: string }[]>> {
  return notConnected();
}
export async function generatePresentationOutline(_m: Material): Promise<AIResult<{ title: string; slides: { title: string; bullets: string[] }[] }>> {
  return notConnected();
}
export async function simplifyText(_t: string, _l: string): Promise<AIResult<string>> { return notConnected(); }
export async function translateText(_t: string, _l: string): Promise<AIResult<string>> { return notConnected(); }

// ============ Gemini-assisted syllabus parsing ============

export interface AIParseSyllabusInput {
  fileName: string;
  sheets: { name: string; rows: string[][] }[];
  deterministicDraft: ParsedSyllabusDraft;
  ignoredRows: IgnoredRow[];
  locale: "ru" | "en";
}

export interface AIStatus {
  ok: boolean;
  provider: "google-gemini";
  configured: boolean;
  model: string | null;
}

let statusCache: { at: number; value: AIStatus } | null = null;

export async function checkAIStatus(force = false): Promise<AIStatus> {
  const now = Date.now();
  if (!force && statusCache && now - statusCache.at < 30_000) return statusCache.value;
  try {
    const res = await fetch("/api/ai/status", { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(String(res.status));
    const j = (await res.json()) as Partial<AIStatus>;
    const value: AIStatus = {
      ok: true,
      provider: "google-gemini",
      configured: Boolean(j.configured),
      model: j.model ?? null,
    };
    statusCache = { at: now, value };
    return value;
  } catch {
    const value: AIStatus = { ok: false, provider: "google-gemini", configured: false, model: null };
    statusCache = { at: now, value };
    return value;
  }
}

interface AIParseSyllabusResponse {
  ok: boolean;
  draft?: ParsedSyllabusDraft;
  warnings?: string[];
  error?: string;
  details?: string;
  model?: string;
}

export async function parseSyllabusWithAI(
  input: AIParseSyllabusInput,
): Promise<AIResult<ParsedSyllabusDraft> & { warnings?: string[]; details?: string }> {
  try {
    const res = await fetch("/api/ai/parse-syllabus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const j = (await res.json()) as AIParseSyllabusResponse;
    if (!j.ok || !j.draft) {
      return {
        ok: false,
        reason: "not_connected",
        message: j.error || "Gemini parser is not configured",
        details: j.details,
      };
    }
    return { ok: true, data: j.draft, warnings: j.warnings };
  } catch (e) {
    return { ok: false, reason: "error", message: (e as Error).message };
  }
}
