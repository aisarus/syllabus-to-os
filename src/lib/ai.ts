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
    const response = await fetch("/api/ai/status", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(String(response.status));
    const payload = (await response.json()) as { configured?: boolean; model?: string | null };
    const value: AIStatus = {
      ok: true,
      provider: "lovable-ai-gateway",
      configured: Boolean(payload.configured),
      model: payload.model ?? null,
    };
    statusCache = { at: now, value };
    return value;
  } catch (error) {
    const value: AIStatus = {
      ok: false,
      provider: "lovable-ai-gateway",
      configured: false,
      model: null,
      error: (error as Error).message,
    };
    statusCache = { at: now, value };
    return value;
  }
}

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

export interface AITrustMetadata {
  model: string;
  promptVersion: string;
  requestedSourceChunkIds: string[];
  rejectedSourceChunkIds: string[];
  uncitedItemCount: number;
}

export interface AIDraftMetadata {
  warnings: string[];
  notFoundInSources?: boolean;
  trust?: AITrustMetadata;
}

export interface NoteDraft extends AIDraftMetadata {
  title: string;
  content: string;
  tags: string[];
  sourceChunkIds: string[];
}

export interface FlashcardDraft {
  front: string;
  back: string;
  sourceChunkIds: string[];
}

export interface FlashcardsDraft extends AIDraftMetadata {
  cards: FlashcardDraft[];
}

export interface QuizQuestionDraft {
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  sourceChunkIds: string[];
}

export interface QuizDraft extends AIDraftMetadata {
  title: string;
  questions: QuizQuestionDraft[];
}

export interface SlideDraft {
  title: string;
  bullets: string[];
  speakerNotes: string;
  sourceChunkIds: string[];
}

export interface PresentationDraft extends AIDraftMetadata {
  title: string;
  slides: SlideDraft[];
}

export interface SimplifyDraft extends AIDraftMetadata {
  title: string;
  text: string;
}

export interface TranslateDraft extends AIDraftMetadata {
  text: string;
}

export interface AssignmentBreakdownDraft extends AIDraftMetadata {
  steps: string[];
  checklist: string[];
  estimatedTime: string;
}

export interface TopicExplanationDraft extends AIDraftMetadata {
  shortExplanation: string;
  detailedExplanation: string;
  keyTerms: { term: string; explanation: string }[];
}

interface AIGenerationResponse<T> {
  ok: boolean;
  draft?: T;
  error?: string;
  model?: string;
  promptVersion?: string;
  warnings?: string[];
  trust?: AITrustMetadata;
}

async function postAI<T extends AIDraftMetadata>(
  endpoint: string,
  input: AIGenerationInput,
): Promise<AIResult<T>> {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const payload = (await response.json()) as AIGenerationResponse<T>;
    if (!payload.ok || !payload.draft) {
      return {
        ok: false,
        reason: /not configured/i.test(payload.error ?? "") ? "not_connected" : "error",
        message: payload.error || "AI request failed",
      };
    }

    const draftWarnings = payload.draft.warnings ?? [];
    const responseWarnings = payload.warnings ?? [];
    const warnings = Array.from(new Set([...draftWarnings, ...responseWarnings]));
    const trust =
      payload.draft.trust ??
      payload.trust ??
      (payload.model && payload.promptVersion
        ? {
            model: payload.model,
            promptVersion: payload.promptVersion,
            requestedSourceChunkIds: input.chunks?.map((chunk) => chunk.id) ?? [],
            rejectedSourceChunkIds: [],
            uncitedItemCount: 0,
          }
        : undefined);

    return {
      ok: true,
      data: {
        ...payload.draft,
        warnings,
        trust,
      },
    };
  } catch (error) {
    return { ok: false, reason: "error", message: (error as Error).message };
  }
}

export const generateNoteDraft = (input: AIGenerationInput) =>
  postAI<NoteDraft>("/api/ai/generate-note", input);
export const generateFlashcardsDraft = (input: AIGenerationInput) =>
  postAI<FlashcardsDraft>("/api/ai/generate-flashcards", input);
export const generateQuizDraft = (input: AIGenerationInput) =>
  postAI<QuizDraft>("/api/ai/generate-quiz", input);
export const generatePresentationOutlineDraft = (input: AIGenerationInput) =>
  postAI<PresentationDraft>("/api/ai/generate-presentation-outline", input);
export const simplifyTextDraft = (input: AIGenerationInput) =>
  postAI<SimplifyDraft>("/api/ai/simplify-text", input);
export const translateTextDraft = (input: AIGenerationInput) =>
  postAI<TranslateDraft>("/api/ai/translate-text", input);
export const generateAssignmentBreakdownDraft = (input: AIGenerationInput) =>
  postAI<AssignmentBreakdownDraft>("/api/ai/generate-assignment-breakdown", input);
export const generateTopicExplanationDraft = (input: AIGenerationInput) =>
  postAI<TopicExplanationDraft>("/api/ai/generate-topic-explanation", input);

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
    const response = await fetch("/api/ai/parse-syllabus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const payload = (await response.json()) as AIParseSyllabusResponse;
    if (!payload.ok || !payload.draft) {
      return {
        ok: false,
        reason: "not_connected",
        message: payload.error || "Lovable AI is not configured",
        details: payload.details,
      };
    }
    return { ok: true, data: payload.draft, warnings: payload.warnings };
  } catch (error) {
    return { ok: false, reason: "error", message: (error as Error).message };
  }
}

function notConnected<T>(): AIResult<T> {
  return { ok: false, reason: "not_connected", message: NOT_CONNECTED_EN };
}
export async function generateNoteFromMaterial(_material: Material) {
  return notConnected<{ title: string; content: string }>();
}
export async function generateQuizFromMaterial(_material: Material) {
  return notConnected<{ title: string; questions: unknown[] }>();
}
export async function generateFlashcardsFromMaterial(_material: Material) {
  return notConnected<unknown[]>();
}
export async function generatePresentationOutline(_material: Material) {
  return notConnected<{ title: string; slides: unknown[] }>();
}
export async function simplifyText(_text: string, _language: string) {
  return notConnected<string>();
}
export async function translateText(_text: string, _language: string) {
  return notConnected<string>();
}
