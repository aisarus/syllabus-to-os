// SERVER-ONLY. Generates one source-grounded guided study pack.

import type { StudyPackActivity } from "../ai";
import {
  type AIGenerationInput,
  type AIRouteResponse,
  type AITrustMetadata,
  validateInput,
} from "./ai-generation";
import { generateGeminiJSON, getGeminiModelName, isGeminiConfigured } from "./gemini";

export const STUDY_PACK_PROMPT_VERSION = "study-pack-v1";

const str = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;
const arr = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
const num = (value: unknown, fallback = 0): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;
const bool = (value: unknown): boolean => value === true;

function languageLabel(language?: string): string {
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
  return lines.join("\n");
}

function chunksBlock(input: AIGenerationInput): string {
  return (input.chunks ?? [])
    .map(
      (chunk, index) =>
        `--- chunk #${index + 1} id=${chunk.id}${chunk.title ? ` title="${chunk.title}"` : ""}${chunk.pageNumber ? ` p.${chunk.pageNumber}` : ""} ---\n${chunk.text}`,
    )
    .join("\n\n");
}

const SCHEMA = `{
  "title": string,
  "orientation": string,
  "orientationSourceChunkIds": string[],
  "estimatedMinutes": number,
  "steps": Array<{
    "title": string,
    "purpose": string,
    "durationMinutes": number,
    "activity": "orient" | "learn" | "recall" | "practice" | "repair",
    "sourceChunkIds": string[]
  }>,
  "note": {
    "title": string,
    "content": string,
    "sourceChunkIds": string[]
  },
  "keyTerms": Array<{
    "term": string,
    "explanation": string,
    "sourceChunkIds": string[]
  }>,
  "cards": Array<{
    "front": string,
    "back": string,
    "sourceChunkIds": string[]
  }>,
  "questions": Array<{
    "prompt": string,
    "options": [string, string, string, string],
    "correctIndex": number,
    "explanation": string,
    "sourceChunkIds": string[]
  }>,
  "unclearAreas": Array<{
    "description": string,
    "sourceChunkIds": string[]
  }>,
  "notFoundInSources": boolean,
  "warnings": string[]
}`;

function buildPrompt(input: AIGenerationInput): string {
  const language = languageLabel(input.targetLanguage ?? input.locale ?? "ru");
  return `You create a complete guided university study pack from selected approved source chunks.

TRUST RULES:
- Use ONLY facts present in SOURCE CHUNKS.
- Never use model memory to fill a gap.
- Never invent citations, dates, formulas, names, numbers, examples, source ids or page numbers.
- Every factual section, step, term, card and question must list exact sourceChunkIds from the allowed ids.
- When the source is incomplete, place the gap in unclearAreas and set notFoundInSources=true instead of guessing.
- Preserve Hebrew academic terminology in the original form when useful, especially inside Russian explanations.
- Return ONLY strict JSON matching the schema.

LEARNING DESIGN:
- Respond in ${language}.
- Build a realistic 25–40 minute sequence, adjusted to the amount of source content.
- Start with a concise orientation: what this material is about and why its parts matter.
- Create 4–7 ordered steps using activities orient, learn, recall, practice or repair.
- Each step must have a concrete purpose and honest duration.
- Write one clean structured note that can stand alone later.
- Extract 5–12 useful terms when supported.
- Create 6–12 atomic flashcards without duplicates or answer leakage.
- Create 5–8 diagnostic multiple-choice questions with exactly four unique options, one correct answer, plausible distractors and a source-grounded explanation.
- Do not claim that completing the pack equals mastery.
- Prompt version: ${STUDY_PACK_PROMPT_VERSION}.

CONTEXT:
${contextBlock(input)}

SOURCE CHUNKS (allowed source ids only):
${chunksBlock(input)}`;
}

interface CitationTracker {
  cite(value: unknown, label: string): string[];
  rejected: Set<string>;
  warnings: string[];
  uncitedItemCount: number;
}

function createCitationTracker(input: AIGenerationInput): CitationTracker {
  const allowed = new Set((input.chunks ?? []).map((chunk) => chunk.id));
  const locale = input.locale ?? "ru";
  const rejected = new Set<string>();
  const warnings: string[] = [];
  const tracker: CitationTracker = {
    rejected,
    warnings,
    uncitedItemCount: 0,
    cite(value: unknown, label: string) {
      const requested = arr<unknown>(value).filter(
        (item): item is string => typeof item === "string",
      );
      const valid = Array.from(new Set(requested.filter((id) => allowed.has(id))));
      const invalid = Array.from(new Set(requested.filter((id) => !allowed.has(id))));
      invalid.forEach((id) => rejected.add(id));
      if (invalid.length > 0) {
        warnings.push(
          locale === "ru"
            ? `${label}: удалены неизвестные sourceChunkIds (${invalid.join(", ")}).`
            : `${label}: unknown sourceChunkIds were removed (${invalid.join(", ")}).`,
        );
      }
      if (allowed.size > 0 && valid.length === 0) {
        tracker.uncitedItemCount += 1;
        warnings.push(
          locale === "ru"
            ? `${label}: нет подтверждённой ссылки на выбранный источник.`
            : `${label}: no validated selected-source citation was returned.`,
        );
      }
      return valid;
    },
  };
  return tracker;
}

function normalizeText(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function normalizeStudyPack(raw: unknown, input: AIGenerationInput) {
  const object = (raw ?? {}) as Record<string, unknown>;
  const tracker = createCitationTracker(input);
  const locale = input.locale ?? "ru";
  const warnings = arr<unknown>(object.warnings).map(String);
  const notFoundInSources = bool(object.notFoundInSources);
  const allowedActivities = new Set<StudyPackActivity>([
    "orient",
    "learn",
    "recall",
    "practice",
    "repair",
  ]);

  const seenSteps = new Set<string>();
  const steps = arr<Record<string, unknown>>(object.steps)
    .map((step, index) => {
      const title = str(step.title).trim();
      const activityValue = str(step.activity) as StudyPackActivity;
      return {
        title,
        purpose: str(step.purpose).trim(),
        durationMinutes: Math.max(3, Math.min(45, Math.round(num(step.durationMinutes, 7)))),
        activity: allowedActivities.has(activityValue) ? activityValue : ("learn" as const),
        sourceChunkIds: tracker.cite(
          step.sourceChunkIds,
          locale === "ru" ? `Шаг ${index + 1}` : `Step ${index + 1}`,
        ),
      };
    })
    .filter((step) => {
      const key = normalizeText(step.title);
      if (!key || seenSteps.has(key)) return false;
      seenSteps.add(key);
      return true;
    })
    .slice(0, 8);

  const noteObject = (object.note ?? {}) as Record<string, unknown>;
  const note = {
    title: str(noteObject.title, str(object.title, "Study Pack")).trim().slice(0, 200),
    content: str(noteObject.content).trim(),
    sourceChunkIds: tracker.cite(
      noteObject.sourceChunkIds,
      locale === "ru" ? "Конспект Study Pack" : "Study Pack note",
    ),
  };

  const seenTerms = new Set<string>();
  const keyTerms = arr<Record<string, unknown>>(object.keyTerms)
    .map((term, index) => ({
      term: str(term.term).trim(),
      explanation: str(term.explanation).trim(),
      sourceChunkIds: tracker.cite(
        term.sourceChunkIds,
        locale === "ru" ? `Термин ${index + 1}` : `Term ${index + 1}`,
      ),
    }))
    .filter((term) => {
      const key = normalizeText(term.term);
      if (!key || !term.explanation || seenTerms.has(key)) return false;
      seenTerms.add(key);
      return true;
    })
    .slice(0, 16);

  const seenCards = new Set<string>();
  const cards = arr<Record<string, unknown>>(object.cards)
    .map((card, index) => ({
      front: str(card.front).trim(),
      back: str(card.back).trim(),
      sourceChunkIds: tracker.cite(
        card.sourceChunkIds,
        locale === "ru" ? `Карточка ${index + 1}` : `Card ${index + 1}`,
      ),
    }))
    .filter((card) => {
      const key = normalizeText(card.front);
      if (!key || !card.back || seenCards.has(key)) return false;
      seenCards.add(key);
      return true;
    })
    .slice(0, 16);

  const seenQuestions = new Set<string>();
  const questions = arr<Record<string, unknown>>(object.questions)
    .map((question, index) => {
      const options = Array.from(
        new Set(arr<unknown>(question.options).map(String).map((option) => option.trim()).filter(Boolean)),
      ).slice(0, 4);
      while (options.length < 4) options.push("");
      return {
        prompt: str(question.prompt).trim(),
        options,
        correctIndex: Math.max(0, Math.min(3, Math.floor(num(question.correctIndex, 0)))),
        explanation: str(question.explanation).trim(),
        sourceChunkIds: tracker.cite(
          question.sourceChunkIds,
          locale === "ru" ? `Вопрос ${index + 1}` : `Question ${index + 1}`,
        ),
      };
    })
    .filter((question) => {
      const key = normalizeText(question.prompt);
      if (!key || question.options.some((option) => !option) || seenQuestions.has(key)) return false;
      seenQuestions.add(key);
      return true;
    })
    .slice(0, 10);

  const unclearAreas = arr<Record<string, unknown>>(object.unclearAreas)
    .map((area, index) => ({
      description: str(area.description).trim(),
      sourceChunkIds: tracker.cite(
        area.sourceChunkIds,
        locale === "ru" ? `Неясная область ${index + 1}` : `Unclear area ${index + 1}`,
      ),
    }))
    .filter((area) => area.description)
    .slice(0, 12);

  warnings.push(...tracker.warnings);
  if (notFoundInSources) {
    warnings.push(
      locale === "ru"
        ? "Часть учебного комплекта нельзя надёжно построить по выбранным источникам."
        : "Part of the study pack could not be grounded in the selected sources.",
    );
  }
  if (questions.length > 0 && questions.some((question) => new Set(question.options).size < 4)) {
    warnings.push(
      locale === "ru"
        ? "Один или несколько вопросов не имеют четырёх уникальных вариантов и требуют правки."
        : "One or more questions do not have four unique options and require editing.",
    );
  }

  return {
    draft: {
      title: str(object.title, "Study Pack").trim().slice(0, 200),
      orientation: str(object.orientation).trim(),
      orientationSourceChunkIds: tracker.cite(
        object.orientationSourceChunkIds,
        locale === "ru" ? "Ориентация" : "Orientation",
      ),
      estimatedMinutes: Math.max(
        10,
        Math.min(
          120,
          Math.round(
            num(
              object.estimatedMinutes,
              steps.reduce((sum, step) => sum + step.durationMinutes, 30),
            ),
          ),
        ),
      ),
      steps,
      note,
      keyTerms,
      cards,
      questions,
      unclearAreas,
      notFoundInSources,
      warnings: Array.from(new Set(warnings)),
    },
    rejectedSourceChunkIds: Array.from(tracker.rejected),
    uncitedItemCount: tracker.uncitedItemCount,
  };
}

export async function runStudyPackGeneration(
  input: AIGenerationInput,
): Promise<AIRouteResponse<unknown>> {
  if (!isGeminiConfigured()) return { ok: false, error: "AI is not configured" };

  const validationError = validateInput(input);
  if (validationError) return { ok: false, error: validationError };
  if (!input.chunks || input.chunks.length === 0) {
    return {
      ok: false,
      error:
        (input.locale ?? "ru") === "ru"
          ? "Выберите хотя бы один подтверждённый фрагмент материала."
          : "Select at least one approved material chunk.",
    };
  }

  const response = await generateGeminiJSON<unknown>(buildPrompt(input), SCHEMA);
  if (!response.ok) {
    return { ok: false, error: response.error, details: response.details };
  }

  const normalized = normalizeStudyPack(response.data, input);
  const model = getGeminiModelName();
  const trust: AITrustMetadata = {
    model,
    promptVersion: STUDY_PACK_PROMPT_VERSION,
    requestedSourceChunkIds: input.chunks.map((chunk) => chunk.id),
    rejectedSourceChunkIds: normalized.rejectedSourceChunkIds,
    uncitedItemCount: normalized.uncitedItemCount,
  };
  const draft = { ...normalized.draft, trust };

  return {
    ok: true,
    draft,
    model,
    promptVersion: STUDY_PACK_PROMPT_VERSION,
    warnings: normalized.draft.warnings,
    trust,
  };
}
