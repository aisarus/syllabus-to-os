// AI provider abstraction (frontend).
// All AI calls go through server routes; keys never leave the server.
// AI output is NEVER auto-saved — callers show a draft, user confirms, then saves.

import type { Material } from "./store";
import type { ParsedSyllabusDraft, IgnoredRow } from "./syllabus-parser";

export type AIResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "not_connected" | "error" | "invalid"; message: string };

const NOT_CONNECTED_EN = "AI is not connected.";
const NOT_CONNECTED_RU = "ИИ не подключён.";

export function notConnectedMessage(lang: "ru" | "en" = "ru") {
  return lang === "ru" ? NOT_CONNECTED_RU : NOT_CONNECTED_EN;
}

export function isAIConnected(): boolean {
  return statusCache?.value.configured === true;
}

// ============ Status ============

export interface AIStatus {
  ok: boolean;
  provider: "lovable-ai-gateway";
  configured: boolean;
  model?: string | null;
  error?: string;
}

let statusCache: { at: number; value: AIStatus } | null = null;

export async function checkAIStatus(force = false): Promise<AIStatus> {
  const now = Date.now();
  if (!force && statusCache && now - statusCache.at < 30_000) return statusCache.value;
  try {
    const res = await fetch("/api/ai/status", { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(String(res.status));
    const j = (await res.json()) as { configured?: boolean; model?: string | null };
    const value: AIStatus = {
      ok: true,
      provider: "lovable-ai-gateway",
      configured: Boolean(j.configured),
      model: j.model ?? null,
    };
    statusCache = { at: now, value };
    return value;
  } catch (e) {
    const value: AIStatus = {
      ok: false,
      provider: "lovable-ai-gateway",
      configured: false,
      model: null,
      error: (e as Error).message,
    };
    statusCache = { at: now, value };
    return value;
  }
}

// ============ Shared input shape ============

export interface AIChunkInput {
  id: string;
  title?: string;
  text: string;
  pageNumber?: number;
  section?: string;
}

export interface AIGenerationInput {
  locale?: "ru" | "en";
  targetLanguage?: "ru" | "en" | "he" | "ar";
  course?: { id?: string; title?: string; number?: string } | null;
  topic?: { id?: string; title?: string } | null;
  material?: { id?: string; title?: string; type?: string } | null;
  chunks?: AIChunkInput[];
  instructions?: string;
  text?: string;
  assignmentTitle?: string;
  assignmentNotes?: string;
}

// ============ Draft shapes ============

export interface NoteDraft { title: string; content: string; tags: string[]; warnings: string[] }
export interface FlashcardDraft { front: string; back: string; sourceChunkIds: string[] }
export interface FlashcardsDraft { cards: FlashcardDraft[]; warnings: string[] }
export interface QuizQuestionDraft { prompt: string; options: string[]; correctIndex: number; explanation: string; sourceChunkIds: string[] }
export interface QuizDraft { title: string; questions: QuizQuestionDraft[]; warnings: string[] }
export interface SlideDraft { title: string; bullets: string[]; speakerNotes: string; sourceChunkIds: string[] }
export interface PresentationDraft { title: string; slides: SlideDraft[]; warnings: string[] }
export interface SimplifyDraft { title: string; text: string; warnings: string[] }
export interface TranslateDraft { text: string; warnings: string[] }
export interface AssignmentBreakdownDraft { steps: string[]; checklist: string[]; estimatedTime: string; warnings: string[] }
export interface TopicExplanationDraft {
  shortExplanation: string;
  detailedExplanation: string;
  keyTerms: { term: string; explanation: string }[];
  warnings: string[];
}

// ============ Generic caller ============

async function postAI<T>(endpoint: string, input: AIGenerationInput): Promise<AIResult<T>> {
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const j = (await res.json()) as { ok: boolean; draft?: T; error?: string };
    if (!j.ok || !j.draft) {
      return {
        ok: false,
        reason: /not configured/i.test(j.error ?? "") ? "not_connected" : "error",
        message: j.error || "AI request failed",
      };
    }
    return { ok: true, data: j.draft };
  } catch (e) {
    return { ok: false, reason: "error", message: (e as Error).message };
  }
}

export const generateNoteDraft = (i: AIGenerationInput) => postAI<NoteDraft>("/api/ai/generate-note", i);
export const generateFlashcardsDraft = (i: AIGenerationInput) => postAI<FlashcardsDraft>("/api/ai/generate-flashcards", i);
export const generateQuizDraft = (i: AIGenerationInput) => postAI<QuizDraft>("/api/ai/generate-quiz", i);
export const generatePresentationOutlineDraft = (i: AIGenerationInput) => postAI<PresentationDraft>("/api/ai/generate-presentation-outline", i);
export const simplifyTextDraft = (i: AIGenerationInput) => postAI<SimplifyDraft>("/api/ai/simplify-text", i);
export const translateTextDraft = (i: AIGenerationInput) => postAI<TranslateDraft>("/api/ai/translate-text", i);
export const generateAssignmentBreakdownDraft = (i: AIGenerationInput) => postAI<AssignmentBreakdownDraft>("/api/ai/generate-assignment-breakdown", i);
export const generateTopicExplanationDraft = (i: AIGenerationInput) => postAI<TopicExplanationDraft>("/api/ai/generate-topic-explanation", i);

// ============ Syllabus AI (kept from previous phase) ============

export interface AIParseSyllabusInput {
  fileName: string;
  sheets: { name: string; rows: string[][] }[];
  deterministicDraft: ParsedSyllabusDraft;
  ignoredRows: IgnoredRow[];
  locale: "ru" | "en";
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
      return { ok: false, reason: "not_connected", message: j.error || "Lovable AI is not configured", details: j.details };
    }
    return { ok: true, data: j.draft, warnings: j.warnings };
  } catch (e) {
    return { ok: false, reason: "error", message: (e as Error).message };
  }
}

// ============ Legacy stubs (backward compat, no fake data) ============

function notConnected<T>(): AIResult<T> {
  return { ok: false, reason: "not_connected", message: NOT_CONNECTED_EN };
}
export async function generateNoteFromMaterial(_m: Material) { return notConnected<{ title: string; content: string }>(); }
export async function generateQuizFromMaterial(_m: Material) { return notConnected<{ title: string; questions: unknown[] }>(); }
export async function generateFlashcardsFromMaterial(_m: Material) { return notConnected<unknown[]>(); }
export async function generatePresentationOutline(_m: Material) { return notConnected<{ title: string; slides: unknown[] }>(); }
export async function simplifyText(_t: string, _l: string) { return notConnected<string>(); }
export async function translateText(_t: string, _l: string) { return notConnected<string>(); }
