// SERVER-ONLY. Shared helper for AI study-generation routes.
// Uses the existing Lovable AI Gateway wrapper (`generateGeminiJSON`).

import { generateGeminiJSON, getGeminiModelName, isGeminiConfigured } from "./gemini";

export const MAX_CHUNKS = 8;
export const MAX_CHARS = 20_000;

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
  // For assignment breakdown / topic explanation only:
  assignmentTitle?: string;
  assignmentNotes?: string;
  text?: string; // for simplify/translate
}

export type AIRouteResponse<T> =
  | { ok: true; draft: T; model: string; warnings?: string[] }
  | { ok: false; error: string; details?: string };

export function validateInput(input: AIGenerationInput): string | null {
  if (!input || typeof input !== "object") return "invalid_input";
  const locale = input.locale ?? "ru";
  if (input.chunks && !Array.isArray(input.chunks)) return "invalid_chunks";
  const chunks = input.chunks ?? [];
  const totalChars = chunks.reduce((n, c) => n + (c.text?.length ?? 0), 0) + (input.text?.length ?? 0);
  if (totalChars > MAX_CHARS) {
    return locale === "ru" ? "Слишком много текста. Выберите меньше чанков." : "Too much text. Select fewer chunks.";
  }
  if (chunks.length > MAX_CHUNKS) {
    return locale === "ru" ? `Максимум ${MAX_CHUNKS} чанков за раз.` : `Maximum ${MAX_CHUNKS} chunks per request.`;
  }
  return null;
}

function langLabel(l?: string): string {
  return { ru: "Russian", en: "English", he: "Hebrew", ar: "Arabic" }[l ?? "ru"] || "Russian";
}

function contextBlock(input: AIGenerationInput): string {
  const lines: string[] = [];
  if (input.course?.title) lines.push(`Course: ${input.course.title}${input.course.number ? ` (${input.course.number})` : ""}`);
  if (input.topic?.title) lines.push(`Topic: ${input.topic.title}`);
  if (input.material?.title) lines.push(`Material: ${input.material.title}${input.material.type ? ` [${input.material.type}]` : ""}`);
  if (input.instructions) lines.push(`User instructions: ${input.instructions}`);
  return lines.length ? lines.join("\n") + "\n" : "";
}

function chunksBlock(input: AIGenerationInput): string {
  const chunks = input.chunks ?? [];
  if (!chunks.length) return "";
  return "SOURCE CHUNKS (use ONLY these facts; each has an id you must reference in sourceChunkIds):\n" +
    chunks.map((c, i) =>
      `--- chunk #${i + 1} id=${c.id}${c.title ? ` title="${c.title}"` : ""}${c.pageNumber ? ` p.${c.pageNumber}` : ""} ---\n${c.text}`
    ).join("\n\n") + "\n";
}

function allChunkIds(input: AIGenerationInput): string[] {
  return (input.chunks ?? []).map((c) => c.id);
}

// ============ Prompt + validation per kind ============

export type AIKind =
  | "note" | "flashcards" | "quiz" | "presentation"
  | "simplify" | "translate" | "assignment" | "topic";

function common(input: AIGenerationInput): { lang: string; loc: "ru" | "en" } {
  const loc = input.locale ?? "ru";
  return { lang: langLabel(input.targetLanguage ?? loc), loc };
}

const BASE_RULES =
  "Use ONLY facts present in SOURCE CHUNKS. Do not invent facts, citations, dates, formulas, names, or numbers. " +
  "If information is insufficient, add a warning string instead of inventing. " +
  "Preserve Hebrew academic terms in original when useful. Return ONLY strict JSON.";

function buildPrompt(kind: AIKind, input: AIGenerationInput): { prompt: string; schema: string } {
  const { lang } = common(input);
  const ctx = contextBlock(input);
  const src = chunksBlock(input);
  const explainIn = `Respond in ${lang}.`;
  switch (kind) {
    case "note":
      return {
        prompt: `${BASE_RULES}\n${explainIn}\nWrite a study note grounded in the source. Include: a short summary, main explanation, key terms, examples (if present in source), and exam-relevance hints (if reasonably inferable from source).\n\n${ctx}${src}`,
        schema: `{ "title": string, "content": string (markdown), "tags": string[], "warnings": string[] }`,
      };
    case "flashcards":
      return {
        prompt: `${BASE_RULES}\n${explainIn}\nCreate 5–15 study flashcards (definitions, terms, distinctions, processes, formulas). Each card must reference the source chunk ids it is based on. Prefer clear, atomic Q/A.\n\n${ctx}${src}`,
        schema: `{ "cards": Array<{ "front": string, "back": string, "sourceChunkIds": string[] }>, "warnings": string[] }`,
      };
    case "quiz":
      return {
        prompt: `${BASE_RULES}\n${explainIn}\nGenerate 5–10 multiple-choice questions. EACH question MUST have exactly 4 options, one correct answer (correctIndex 0..3), plausible distractors, and an explanation grounded in the source. Reference source chunk ids.\n\n${ctx}${src}`,
        schema: `{ "title": string, "questions": Array<{ "prompt": string, "options": [string,string,string,string], "correctIndex": number, "explanation": string, "sourceChunkIds": string[] }>, "warnings": string[] }`,
      };
    case "presentation":
      return {
        prompt: `${BASE_RULES}\n${explainIn}\nBuild an academic presentation outline of 5–8 slides. Each slide: title, 3–5 bullets, speakerNotes. Preserve source references (sourceChunkIds).\n\n${ctx}${src}`,
        schema: `{ "title": string, "slides": Array<{ "title": string, "bullets": string[], "speakerNotes": string, "sourceChunkIds": string[] }>, "warnings": string[] }`,
      };
    case "simplify":
      return {
        prompt: `${BASE_RULES}\n${explainIn}\nSimplify the following text for a student, preserving meaning. Do not add facts.\n\n${ctx}TEXT:\n${input.text ?? ""}\n${src}`,
        schema: `{ "title": string, "text": string, "warnings": string[] }`,
      };
    case "translate":
      return {
        prompt: `${BASE_RULES}\nTranslate the following text to ${lang}. Preserve technical/Hebrew academic terms when appropriate; keep numbers and names exact.\n\n${ctx}TEXT:\n${input.text ?? ""}\n${src}`,
        schema: `{ "text": string, "warnings": string[] }`,
      };
    case "assignment":
      return {
        prompt: `${BASE_RULES}\n${explainIn}\nBreak down the following assignment into concrete steps and a checklist. Estimate total time (e.g. "3 h"). Base steps on source when available.\n\n${ctx}Assignment: ${input.assignmentTitle ?? ""}\nNotes: ${input.assignmentNotes ?? ""}\n${src}`,
        schema: `{ "steps": string[], "checklist": string[], "estimatedTime": string, "warnings": string[] }`,
      };
    case "topic":
      return {
        prompt: `${BASE_RULES}\n${explainIn}\nExplain the topic to a student. Provide a short one-paragraph explanation and a detailed explanation, plus key terms with concise explanations. If no chunks are provided, add a warning that the explanation is not source-grounded.\n\n${ctx}${src}`,
        schema: `{ "shortExplanation": string, "detailedExplanation": string, "keyTerms": Array<{ "term": string, "explanation": string }>, "warnings": string[] }`,
      };
  }
}

// ---- validators / normalizers ----

const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);
const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const num = (v: unknown, d = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : d);

function filterChunkIds(ids: unknown, allowed: Set<string>): string[] {
  return arr<string>(ids).filter((x) => typeof x === "string" && allowed.has(x));
}

function normalize(kind: AIKind, raw: unknown, input: AIGenerationInput): unknown {
  const allowed = new Set(allChunkIds(input));
  const o = (raw ?? {}) as Record<string, unknown>;
  const warnings = arr<unknown>(o.warnings).map((w) => String(w));
  switch (kind) {
    case "note":
      return {
        title: str(o.title, "Untitled").slice(0, 200),
        content: str(o.content),
        tags: arr<unknown>(o.tags).map((t) => String(t)).slice(0, 20),
        warnings,
      };
    case "flashcards": {
      const cards = arr<Record<string, unknown>>(o.cards)
        .map((c) => ({
          front: str(c.front).trim(),
          back: str(c.back).trim(),
          sourceChunkIds: filterChunkIds(c.sourceChunkIds, allowed),
        }))
        .filter((c) => c.front && c.back)
        .slice(0, 20);
      return { cards, warnings };
    }
    case "quiz": {
      const questions = arr<Record<string, unknown>>(o.questions)
        .map((q) => {
          const opts = arr<unknown>(q.options).map((x) => String(x)).slice(0, 4);
          while (opts.length < 4) opts.push("");
          const ci = Math.max(0, Math.min(3, Math.floor(num(q.correctIndex, 0))));
          return {
            prompt: str(q.prompt).trim(),
            options: opts.slice(0, 4),
            correctIndex: ci,
            explanation: str(q.explanation).trim(),
            sourceChunkIds: filterChunkIds(q.sourceChunkIds, allowed),
          };
        })
        .filter((q) => q.prompt && q.options.filter(Boolean).length >= 2)
        .slice(0, 15);
      return { title: str(o.title, "Quiz").slice(0, 200), questions, warnings };
    }
    case "presentation": {
      const slides = arr<Record<string, unknown>>(o.slides)
        .map((s) => ({
          title: str(s.title).trim(),
          bullets: arr<unknown>(s.bullets).map((b) => String(b)).filter(Boolean).slice(0, 8),
          speakerNotes: str(s.speakerNotes),
          sourceChunkIds: filterChunkIds(s.sourceChunkIds, allowed),
        }))
        .filter((s) => s.title)
        .slice(0, 12);
      return { title: str(o.title, "Outline").slice(0, 200), slides, warnings };
    }
    case "simplify":
      return { title: str(o.title, "Simplified"), text: str(o.text), warnings };
    case "translate":
      return { text: str(o.text), warnings };
    case "assignment":
      return {
        steps: arr<unknown>(o.steps).map((x) => String(x)).filter(Boolean).slice(0, 20),
        checklist: arr<unknown>(o.checklist).map((x) => String(x)).filter(Boolean).slice(0, 20),
        estimatedTime: str(o.estimatedTime),
        warnings,
      };
    case "topic":
      return {
        shortExplanation: str(o.shortExplanation),
        detailedExplanation: str(o.detailedExplanation),
        keyTerms: arr<Record<string, unknown>>(o.keyTerms)
          .map((k) => ({ term: str(k.term).trim(), explanation: str(k.explanation) }))
          .filter((k) => k.term)
          .slice(0, 30),
        warnings,
      };
  }
}

export async function runAIGeneration(
  kind: AIKind,
  input: AIGenerationInput,
): Promise<AIRouteResponse<unknown>> {
  if (!isGeminiConfigured()) return { ok: false, error: "AI is not configured" };

  const validationError = validateInput(input);
  if (validationError) return { ok: false, error: validationError };

  // Topic explanation without chunks is allowed but warned; other kinds require chunks unless text-only:
  const needsChunks: AIKind[] = ["note", "flashcards", "quiz", "presentation"];
  if (needsChunks.includes(kind) && (!input.chunks || input.chunks.length === 0)) {
    const loc = input.locale ?? "ru";
    return { ok: false, error: loc === "ru" ? "Выберите хотя бы один чанк материала." : "Select at least one material chunk." };
  }

  const { prompt, schema } = buildPrompt(kind, input);
  const res = await generateGeminiJSON<unknown>(prompt, schema);
  if (!res.ok) return { ok: false, error: res.error, details: res.details };

  const draft = normalize(kind, res.data, input);
  const warnings: string[] = ((draft as { warnings?: string[] }).warnings ?? []).slice();
  if (kind === "topic" && (input.chunks ?? []).length === 0) {
    warnings.push((input.locale ?? "ru") === "ru" ? "Нет исходных чанков — объяснение не привязано к материалу." : "No source chunks — explanation is not grounded.");
  }
  return { ok: true, draft, model: getGeminiModelName(), warnings };
}
