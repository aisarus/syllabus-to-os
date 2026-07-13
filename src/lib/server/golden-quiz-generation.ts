import { formatGoldenQuizFeedback } from "../golden-quiz";
import {
  generateGeminiJSON,
  getGeminiModelName,
  isGeminiConfigured,
} from "./gemini";
import {
  validateInput,
  type AIGenerationInput,
  type AIRouteResponse,
  type AITrustMetadata,
} from "./ai-generation";

export const GOLDEN_QUIZ_PROMPT_VERSION = "golden-quiz-v1";

type RawQuestion = Record<string, unknown>;

type QuizDraft = {
  title: string;
  questions: Array<{
    prompt: string;
    options: string[];
    correctIndex: number;
    explanation: string;
    sourceChunkIds: string[];
  }>;
  notFoundInSources: boolean;
  warnings: string[];
  trust: AITrustMetadata;
};

export async function runGoldenQuizGeneration(
  input: AIGenerationInput,
): Promise<AIRouteResponse<QuizDraft>> {
  if (!isGeminiConfigured()) return { ok: false, error: "AI is not configured" };
  const validationError = validateInput(input);
  if (validationError) return { ok: false, error: validationError };

  const locale = input.locale ?? "ru";
  const chunks = input.chunks ?? [];
  if (chunks.length === 0) {
    return {
      ok: false,
      error:
        locale === "ru"
          ? "Выберите хотя бы один чанк материала."
          : "Select at least one material chunk.",
    };
  }

  const allowedIds = new Set(chunks.map((chunk) => chunk.id));
  const exactOne = /(?:ровно|exactly)\s+(?:один|one)|one improved replacement/i.test(
    input.instructions ?? "",
  );
  const questionCountRule = exactOne
    ? "Create exactly ONE replacement question."
    : "Create 5 to 10 questions.";
  const context = [
    input.course?.title
      ? `Course: ${input.course.title}${input.course.number ? ` (${input.course.number})` : ""}`
      : "",
    input.topic?.title ? `Topic: ${input.topic.title}` : "",
    input.material?.title
      ? `Material: ${input.material.title}${input.material.type ? ` [${input.material.type}]` : ""}`
      : "",
    input.instructions ? `User instructions: ${input.instructions}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const sources = chunks
    .map(
      (chunk, index) =>
        `--- chunk #${index + 1} id=${chunk.id}${chunk.title ? ` title="${chunk.title}"` : ""}${chunk.pageNumber ? ` p.${chunk.pageNumber}` : ""} ---\n${chunk.text}`,
    )
    .join("\n\n");

  const prompt = `You generate a polished academic quiz in the exact interaction style of a high-quality language-aware study trainer.
Prompt version: ${GOLDEN_QUIZ_PROMPT_VERSION}.

NON-NEGOTIABLE SOURCE RULES
- Use ONLY facts present in SOURCE CHUNKS.
- Never invent names, dates, definitions, formulas, citations, source ids or explanations.
- Every question must list exact supporting sourceChunkIds, using only ids supplied below.
- When the source does not support a safe question, omit it. If too little remains, set notFoundInSources=true and explain this in warnings.

QUESTION QUALITY CONTRACT
- ${questionCountRule}
- Every question has exactly FOUR answer options and exactly ONE correct answer.
- Distractors must be plausible, same-category alternatives. Avoid joke answers, obvious length clues, duplicates, “all of the above”, and unsupported trivia.
- Return a short correctExplanation grounded in the source.
- Return a concise memoryHint that helps recall the distinction without adding facts.
- Return optionRationales with exactly four entries, aligned by option index. Explain why the correct option is correct and why EACH distractor is wrong.
- A rationale must discuss that exact option rather than merely repeat “incorrect”.

LANGUAGE CONTRACT
- Keep prompt and options in the dominant language of the source material. For Hebrew source material, prompt and options stay in Hebrew.
- When the interface locale is Russian, also return promptTranslation and four optionTranslations in Russian. Preserve important Hebrew terminology inside the Russian explanation where useful.
- Mixed RTL/LTR text must remain readable. Do not transliterate Hebrew unless the source itself does.

${context ? `${context}\n\n` : ""}SOURCE CHUNKS:\n${sources}`;
  const schema = `{
    "title": string,
    "questions": Array<{
      "prompt": string,
      "promptTranslation"?: string,
      "options": [string, string, string, string],
      "optionTranslations"?: [string, string, string, string],
      "correctIndex": number,
      "correctExplanation": string,
      "memoryHint": string,
      "optionRationales": [string, string, string, string],
      "sourceChunkIds": string[]
    }>,
    "notFoundInSources": boolean,
    "warnings": string[]
  }`;

  const response = await generateGeminiJSON<unknown>(prompt, schema);
  if (!response.ok) {
    return { ok: false, error: response.error, details: response.details };
  }

  const object = asObject(response.data);
  const warnings = asArray(object.warnings).map(String).filter(Boolean);
  const rejectedSourceChunkIds = new Set<string>();
  let uncitedItemCount = 0;

  const questions = asArray<RawQuestion>(object.questions)
    .map((raw, index) => {
      const options = normalizeFourStrings(raw.options);
      const rationales = normalizeFourStrings(raw.optionRationales);
      const optionTranslations = normalizeOptionalFourStrings(raw.optionTranslations);
      const requestedIds = asArray<unknown>(raw.sourceChunkIds)
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean);
      const sourceChunkIds = Array.from(
        new Set(
          requestedIds.filter((id) => {
            if (allowedIds.has(id)) return true;
            rejectedSourceChunkIds.add(id);
            return false;
          }),
        ),
      );
      if (sourceChunkIds.length === 0) {
        uncitedItemCount += 1;
        warnings.push(
          locale === "ru"
            ? `Вопрос ${index + 1}: нет подтверждённой ссылки на выбранный источник.`
            : `Question ${index + 1}: no validated selected-source citation was returned.`,
        );
      }
      const correctIndex = clampIndex(raw.correctIndex, options.length);
      const promptText = asString(raw.prompt).trim();
      const correctExplanation = asString(raw.correctExplanation).trim();
      const memoryHint = asString(raw.memoryHint).trim();
      const feedback = formatGoldenQuizFeedback(
        {
          correctExplanation,
          memoryHint,
          optionRationales: rationales,
          promptTranslation: asString(raw.promptTranslation).trim() || undefined,
          optionTranslations,
        },
        locale,
      );
      return {
        prompt: promptText,
        options,
        correctIndex,
        explanation: feedback,
        sourceChunkIds,
      };
    })
    .filter(
      (question) =>
        question.prompt.length > 0 &&
        question.options.every((option) => option.length > 0) &&
        new Set(question.options.map(normalizeComparable)).size === 4,
    )
    .slice(0, exactOne ? 1 : 10);

  for (const rejectedId of rejectedSourceChunkIds) {
    warnings.push(
      locale === "ru"
        ? `Удалена неизвестная ссылка на источник: ${rejectedId}.`
        : `Unknown source reference removed: ${rejectedId}.`,
    );
  }
  if (questions.length === 0) {
    warnings.push(
      locale === "ru"
        ? "Модель не вернула ни одного валидного вопроса с четырьмя уникальными вариантами."
        : "The model returned no valid question with four unique options.",
    );
  }

  const notFoundInSources = object.notFoundInSources === true || questions.length === 0;
  const model = getGeminiModelName();
  const trust: AITrustMetadata = {
    model,
    promptVersion: GOLDEN_QUIZ_PROMPT_VERSION,
    requestedSourceChunkIds: chunks.map((chunk) => chunk.id),
    rejectedSourceChunkIds: Array.from(rejectedSourceChunkIds),
    uncitedItemCount,
  };
  const draft: QuizDraft = {
    title: asString(object.title, locale === "ru" ? "Учебный квиз" : "Study quiz").slice(0, 200),
    questions,
    notFoundInSources,
    warnings: Array.from(new Set(warnings)),
    trust,
  };

  return {
    ok: true,
    draft,
    model,
    promptVersion: GOLDEN_QUIZ_PROMPT_VERSION,
    warnings: draft.warnings,
    trust,
  };
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function normalizeFourStrings(value: unknown): [string, string, string, string] {
  const values = asArray<unknown>(value)
    .slice(0, 4)
    .map((item) => String(item ?? "").trim());
  while (values.length < 4) values.push("");
  return values as [string, string, string, string];
}

function normalizeOptionalFourStrings(
  value: unknown,
): [string, string, string, string] | undefined {
  const values = normalizeFourStrings(value);
  return values.some(Boolean) ? values : undefined;
}

function clampIndex(value: unknown, optionCount: number): number {
  const number = typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : 0;
  return Math.max(0, Math.min(Math.max(0, optionCount - 1), number));
}

function normalizeComparable(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}
