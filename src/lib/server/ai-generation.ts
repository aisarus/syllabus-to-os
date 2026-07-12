// SERVER-ONLY. Shared helper for AI study-generation routes.
// Uses the existing Lovable AI Gateway wrapper (`generateGeminiJSON`).

import { generateGeminiJSON, getGeminiModelName, isGeminiConfigured } from "./gemini";

export const MAX_CHUNKS = 8;
export const MAX_CHARS = 20_000;
export const AI_PROMPT_VERSION = "study-grounding-v1";

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
  assignmentTitle?: string;
  assignmentNotes?: string;
  text?: string;
}

export interface AITrustMetadata {
  model: string;
  promptVersion: string;
  requestedSourceChunkIds: string[];
  rejectedSourceChunkIds: string[];
  uncitedItemCount: number;
}

export type AIRouteResponse<T> =
  | {
      ok: true;
      draft: T;
      model: string;
      promptVersion: string;
      warnings?: string[];
      trust: AITrustMetadata;
    }
  | { ok: false; error: string; details?: string };

export function validateInput(input: AIGenerationInput): string | null {
  if (!input || typeof input !== "object") return "invalid_input";
  const locale = input.locale ?? "ru";
  if (input.chunks && !Array.isArray(input.chunks)) return "invalid_chunks";
  const chunks = input.chunks ?? [];
  const totalChars =
    chunks.reduce((count, chunk) => count + (chunk.text?.length ?? 0), 0) +
    (input.text?.length ?? 0);
  if (totalChars > MAX_CHARS) {
    return locale === "ru"
      ? "Слишком много текста. Выберите меньше чанков."
      : "Too much text. Select fewer chunks.";
  }
  if (chunks.length > MAX_CHUNKS) {
    return locale === "ru"
      ? `Максимум ${MAX_CHUNKS} чанков за раз.`
      : `Maximum ${MAX_CHUNKS} chunks per request.`;
  }
  return null;
}

function langLabel(language?: string): string {
  return (
    { ru: "Russian", en: "English", he: "Hebrew", ar: "Arabic" }[
      language ?? "ru"
    ] || "Russian"
  );
}

function contextBlock(input: AIGenerationInput): string {
  const lines: string[] = [];
  if (input.course?.title) {
    lines.push(
      `Course: ${input.course.title}${input.course.number ? ` (${input.course.number})` : ""}`,
    );
  }
  if (input.topic?.title) lines.push(`Topic: ${input.topic.title}`);
  if (input.material?.title) {
    lines.push(
      `Material: ${input.material.title}${input.material.type ? ` [${input.material.type}]` : ""}`,
    );
  }
  if (input.instructions) lines.push(`User instructions: ${input.instructions}`);
  return lines.length ? `${lines.join("\n")}\n` : "";
}

function chunksBlock(input: AIGenerationInput): string {
  const chunks = input.chunks ?? [];
  if (!chunks.length) return "";
  return (
    "SOURCE CHUNKS (use ONLY these facts; sourceChunkIds may contain ONLY ids listed here):\n" +
    chunks
      .map(
        (chunk, index) =>
          `--- chunk #${index + 1} id=${chunk.id}${chunk.title ? ` title="${chunk.title}"` : ""}${chunk.pageNumber ? ` p.${chunk.pageNumber}` : ""} ---\n${chunk.text}`,
      )
      .join("\n\n") +
    "\n"
  );
}

function allChunkIds(input: AIGenerationInput): string[] {
  return (input.chunks ?? []).map((chunk) => chunk.id);
}

export type AIKind =
  | "note"
  | "flashcards"
  | "quiz"
  | "presentation"
  | "simplify"
  | "translate"
  | "assignment"
  | "topic";

function common(input: AIGenerationInput): { lang: string; loc: "ru" | "en" } {
  const loc = input.locale ?? "ru";
  return { lang: langLabel(input.targetLanguage ?? loc), loc };
}

const BASE_RULES =
  "Use ONLY facts present in SOURCE CHUNKS. Do not invent facts, citations, dates, formulas, names, numbers, source ids, or page numbers. " +
  "Every factual generated item must list the exact sourceChunkIds that support it. " +
  "If the selected sources do not contain enough information, set notFoundInSources=true and add a warning instead of guessing. " +
  "Preserve Hebrew academic terms in their original form when useful, especially inside Russian explanations. " +
  `Prompt version: ${AI_PROMPT_VERSION}. Return ONLY strict JSON.`;

function buildPrompt(kind: AIKind, input: AIGenerationInput): { prompt: string; schema: string } {
  const { lang } = common(input);
  const context = contextBlock(input);
  const sources = chunksBlock(input);
  const respondIn = `Respond in ${lang}.`;

  switch (kind) {
    case "note":
      return {
        prompt: `${BASE_RULES}\n${respondIn}\nWrite a source-grounded study note with a short summary, main explanation, key terms, examples only when present, and exam-relevance hints only when supported. Return all chunk ids that support the note.\n\n${context}${sources}`,
        schema:
          `{ "title": string, "content": string, "tags": string[], "sourceChunkIds": string[], "notFoundInSources": boolean, "warnings": string[] }`,
      };
    case "flashcards":
      return {
        prompt: `${BASE_RULES}\n${respondIn}\nCreate 5–15 clear atomic study flashcards. Each card must list supporting sourceChunkIds. Do not create a card when the answer is not present in the sources.\n\n${context}${sources}`,
        schema:
          `{ "cards": Array<{ "front": string, "back": string, "sourceChunkIds": string[] }>, "notFoundInSources": boolean, "warnings": string[] }`,
      };
    case "quiz":
      return {
        prompt: `${BASE_RULES}\n${respondIn}\nGenerate 5–10 multiple-choice questions. Each question must have exactly four options, one correct answer, plausible distractors, a source-grounded explanation, and supporting sourceChunkIds.\n\n${context}${sources}`,
        schema:
          `{ "title": string, "questions": Array<{ "prompt": string, "options": [string,string,string,string], "correctIndex": number, "explanation": string, "sourceChunkIds": string[] }>, "notFoundInSources": boolean, "warnings": string[] }`,
      };
    case "presentation":
      return {
        prompt: `${BASE_RULES}\n${respondIn}\nBuild an academic outline of 5–8 slides. Each slide must have a title, 3–5 bullets, speaker notes, and supporting sourceChunkIds.\n\n${context}${sources}`,
        schema:
          `{ "title": string, "slides": Array<{ "title": string, "bullets": string[], "speakerNotes": string, "sourceChunkIds": string[] }>, "notFoundInSources": boolean, "warnings": string[] }`,
      };
    case "simplify":
      return {
        prompt: `${BASE_RULES}\n${respondIn}\nSimplify the following text without adding facts.\n\n${context}TEXT:\n${input.text ?? ""}\n${sources}`,
        schema: `{ "title": string, "text": string, "notFoundInSources": boolean, "warnings": string[] }`,
      };
    case "translate":
      return {
        prompt: `${BASE_RULES}\nTranslate the following text to ${lang}. Preserve technical and Hebrew academic terms when appropriate; keep numbers and names exact.\n\n${context}TEXT:\n${input.text ?? ""}\n${sources}`,
        schema: `{ "text": string, "notFoundInSources": boolean, "warnings": string[] }`,
      };
    case "assignment":
      return {
        prompt: `${BASE_RULES}\n${respondIn}\nBreak the assignment into concrete steps and a checklist. Estimate total time. Base factual requirements only on the provided source.\n\n${context}Assignment: ${input.assignmentTitle ?? ""}\nNotes: ${input.assignmentNotes ?? ""}\n${sources}`,
        schema:
          `{ "steps": string[], "checklist": string[], "estimatedTime": string, "notFoundInSources": boolean, "warnings": string[] }`,
      };
    case "topic":
      return {
        prompt: `${BASE_RULES}\n${respondIn}\nExplain the topic with a short explanation, a detailed explanation, and key terms. When no source supports a claim, mark the result as not found rather than using model memory.\n\n${context}${sources}`,
        schema:
          `{ "shortExplanation": string, "detailedExplanation": string, "keyTerms": Array<{ "term": string, "explanation": string }>, "notFoundInSources": boolean, "warnings": string[] }`,
      };
  }
}

const str = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;
const arr = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
const num = (value: unknown, fallback = 0): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;
const bool = (value: unknown): boolean => value === true;

interface SourceIdResult {
  valid: string[];
  rejected: string[];
}

function validateChunkIds(value: unknown, allowed: Set<string>): SourceIdResult {
  const requested = arr<unknown>(value).filter((item): item is string => typeof item === "string");
  const valid = Array.from(new Set(requested.filter((id) => allowed.has(id))));
  const rejected = Array.from(new Set(requested.filter((id) => !allowed.has(id))));
  return { valid, rejected };
}

interface NormalizationResult {
  draft: Record<string, unknown>;
  rejectedSourceChunkIds: string[];
  uncitedItemCount: number;
}

function trustWarning(locale: "ru" | "en", value: string): string {
  return locale === "ru" ? value : value;
}

function normalize(kind: AIKind, raw: unknown, input: AIGenerationInput): NormalizationResult {
  const allowed = new Set(allChunkIds(input));
  const object = (raw ?? {}) as Record<string, unknown>;
  const locale = input.locale ?? "ru";
  const warnings = arr<unknown>(object.warnings).map((warning) => String(warning));
  const rejected = new Set<string>();
  let uncitedItemCount = 0;
  const notFoundInSources = bool(object.notFoundInSources);

  const citations = (value: unknown, label: string): string[] => {
    const result = validateChunkIds(value, allowed);
    result.rejected.forEach((id) => rejected.add(id));
    if (result.rejected.length > 0) {
      warnings.push(
        locale === "ru"
          ? `${label}: удалены неизвестные sourceChunkIds (${result.rejected.join(", ")}).`
          : `${label}: unknown sourceChunkIds were removed (${result.rejected.join(", ")}).`,
      );
    }
    if (allowed.size > 0 && result.valid.length === 0) {
      uncitedItemCount += 1;
      warnings.push(
        locale === "ru"
          ? `${label}: нет подтверждённой ссылки на выбранный источник.`
          : `${label}: no validated selected-source citation was returned.`,
      );
    }
    return result.valid;
  };

  let draft: Record<string, unknown>;
  switch (kind) {
    case "note":
      draft = {
        title: str(object.title, "Untitled").slice(0, 200),
        content: str(object.content),
        tags: arr<unknown>(object.tags).map((tag) => String(tag)).slice(0, 20),
        sourceChunkIds: citations(object.sourceChunkIds, locale === "ru" ? "Конспект" : "Note"),
        notFoundInSources,
        warnings,
      };
      break;
    case "flashcards": {
      const cards = arr<Record<string, unknown>>(object.cards)
        .map((card, index) => ({
          front: str(card.front).trim(),
          back: str(card.back).trim(),
          sourceChunkIds: citations(
            card.sourceChunkIds,
            locale === "ru" ? `Карточка ${index + 1}` : `Card ${index + 1}`,
          ),
        }))
        .filter((card) => card.front && card.back)
        .slice(0, 20);
      draft = { cards, notFoundInSources, warnings };
      break;
    }
    case "quiz": {
      const questions = arr<Record<string, unknown>>(object.questions)
        .map((question, index) => {
          const options = arr<unknown>(question.options).map(String).slice(0, 4);
          while (options.length < 4) options.push("");
          return {
            prompt: str(question.prompt).trim(),
            options,
            correctIndex: Math.max(0, Math.min(3, Math.floor(num(question.correctIndex, 0)))),
            explanation: str(question.explanation).trim(),
            sourceChunkIds: citations(
              question.sourceChunkIds,
              locale === "ru" ? `Вопрос ${index + 1}` : `Question ${index + 1}`,
            ),
          };
        })
        .filter((question) => question.prompt && question.options.filter(Boolean).length >= 2)
        .slice(0, 15);
      draft = {
        title: str(object.title, "Quiz").slice(0, 200),
        questions,
        notFoundInSources,
        warnings,
      };
      break;
    }
    case "presentation": {
      const slides = arr<Record<string, unknown>>(object.slides)
        .map((slide, index) => ({
          title: str(slide.title).trim(),
          bullets: arr<unknown>(slide.bullets).map(String).filter(Boolean).slice(0, 8),
          speakerNotes: str(slide.speakerNotes),
          sourceChunkIds: citations(
            slide.sourceChunkIds,
            locale === "ru" ? `Слайд ${index + 1}` : `Slide ${index + 1}`,
          ),
        }))
        .filter((slide) => slide.title)
        .slice(0, 12);
      draft = {
        title: str(object.title, "Outline").slice(0, 200),
        slides,
        notFoundInSources,
        warnings,
      };
      break;
    }
    case "simplify":
      draft = {
        title: str(object.title, "Simplified"),
        text: str(object.text),
        notFoundInSources,
        warnings,
      };
      break;
    case "translate":
      draft = { text: str(object.text), notFoundInSources, warnings };
      break;
    case "assignment":
      draft = {
        steps: arr<unknown>(object.steps).map(String).filter(Boolean).slice(0, 20),
        checklist: arr<unknown>(object.checklist).map(String).filter(Boolean).slice(0, 20),
        estimatedTime: str(object.estimatedTime),
        notFoundInSources,
        warnings,
      };
      break;
    case "topic":
      draft = {
        shortExplanation: str(object.shortExplanation),
        detailedExplanation: str(object.detailedExplanation),
        keyTerms: arr<Record<string, unknown>>(object.keyTerms)
          .map((term) => ({
            term: str(term.term).trim(),
            explanation: str(term.explanation),
          }))
          .filter((term) => term.term)
          .slice(0, 30),
        notFoundInSources,
        warnings,
      };
      break;
  }

  if (notFoundInSources) {
    warnings.push(
      locale === "ru"
        ? "Выбранные источники не содержат достаточно информации для части или всего результата."
        : "The selected sources do not contain enough information for part or all of the result.",
    );
  }

  return {
    draft,
    rejectedSourceChunkIds: Array.from(rejected),
    uncitedItemCount,
  };
}

export async function runAIGeneration(
  kind: AIKind,
  input: AIGenerationInput,
): Promise<AIRouteResponse<unknown>> {
  if (!isGeminiConfigured()) return { ok: false, error: "AI is not configured" };

  const validationError = validateInput(input);
  if (validationError) return { ok: false, error: validationError };

  const needsChunks: AIKind[] = ["note", "flashcards", "quiz", "presentation"];
  if (needsChunks.includes(kind) && (!input.chunks || input.chunks.length === 0)) {
    const locale = input.locale ?? "ru";
    return {
      ok: false,
      error:
        locale === "ru"
          ? "Выберите хотя бы один чанк материала."
          : "Select at least one material chunk.",
    };
  }

  const { prompt, schema } = buildPrompt(kind, input);
  const response = await generateGeminiJSON<unknown>(prompt, schema);
  if (!response.ok) {
    return { ok: false, error: response.error, details: response.details };
  }

  const normalized = normalize(kind, response.data, input);
  const model = getGeminiModelName();
  const trust: AITrustMetadata = {
    model,
    promptVersion: AI_PROMPT_VERSION,
    requestedSourceChunkIds: allChunkIds(input),
    rejectedSourceChunkIds: normalized.rejectedSourceChunkIds,
    uncitedItemCount: normalized.uncitedItemCount,
  };
  const draft = { ...normalized.draft, trust };
  const warnings = arr<string>(draft.warnings).slice();

  if (kind === "topic" && (input.chunks ?? []).length === 0) {
    warnings.push(
      (input.locale ?? "ru") === "ru"
        ? "Нет исходных чанков — объяснение не привязано к материалу."
        : "No source chunks — explanation is not grounded.",
    );
    draft.warnings = warnings;
  }

  return {
    ok: true,
    draft,
    model,
    promptVersion: AI_PROMPT_VERSION,
    warnings,
    trust,
  };
}
