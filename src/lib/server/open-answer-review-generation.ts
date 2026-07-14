// SERVER-ONLY. Reviews a submitted open answer against explicitly selected source chunks.

import {
  formatOpenAnswerReviewSummary,
  normalizeOpenAnswerReview,
  type OpenAnswerReviewDraft,
} from "../open-answer-review";
import {
  type AIGenerationInput,
  type AIRouteResponse,
  type AITrustMetadata,
  validateInput,
} from "./ai-generation";
import { generateGeminiJSON, getGeminiModelName, isGeminiConfigured } from "./gemini";

export const OPEN_ANSWER_REVIEW_PROMPT_VERSION = "open-answer-review-v1";

export interface OpenAnswerReviewGenerationInput extends AIGenerationInput {
  concept?: { id?: string; title?: string; description?: string } | null;
  kind?: "explanation" | "application";
  prompt?: string;
  response?: string;
  repairContext?: {
    evidenceId?: string;
    previousPrompt?: string;
    previousResponse?: string;
    previousMistakeKind?: string;
    previousReviewSummary?: string;
  } | null;
}

const SCHEMA = `{
  "suggestedOutcome": "success" | "failure",
  "suggestedScore": number,
  "feedback": string,
  "strengths": string[],
  "missingPoints": string[],
  "suggestedMistakeKind": "retrieval" | "confusion" | "application" | "careless" | "unclassified",
  "supportedSourceChunkIds": string[],
  "warnings": string[],
  "notFoundInSources": boolean
}`;

function languageLabel(language?: string): string {
  return (
    { ru: "Russian", en: "English", he: "Hebrew", ar: "Arabic" }[language ?? "ru"] || "Russian"
  );
}

function buildPrompt(input: OpenAnswerReviewGenerationInput): string {
  const language = languageLabel(input.targetLanguage ?? input.locale ?? "ru");
  const chunks = (input.chunks ?? [])
    .map(
      (chunk, index) =>
        `--- chunk #${index + 1} id=${chunk.id}${chunk.title ? ` title="${chunk.title}"` : ""}${chunk.pageNumber ? ` p.${chunk.pageNumber}` : ""} ---\n${chunk.text}`,
    )
    .join("\n\n");
  const repair = input.repairContext?.evidenceId
    ? `PREVIOUS FAILED EVIDENCE TO REPAIR:
Evidence id: ${input.repairContext.evidenceId}
Previous prompt: ${input.repairContext.previousPrompt ?? "(not supplied)"}
Previous response: ${input.repairContext.previousResponse ?? "(not supplied)"}
Previous mistake: ${input.repairContext.previousMistakeKind ?? "unclassified"}
Previous review: ${input.repairContext.previousReviewSummary ?? "(not supplied)"}`
    : "This is not linked to a previous failed attempt.";

  return `You review one student's open answer for a university study system.

TRUST RULES:
- Judge ONLY against facts, distinctions and terminology explicitly present in SOURCE CHUNKS.
- Never use model memory or outside knowledge to mark an answer correct or incorrect.
- Do not rewrite the student's answer and do not invent an ideal answer from outside the sources.
- Every positive or negative claim in feedback must be supportable by the selected chunks.
- List only exact allowed sourceChunkIds in supportedSourceChunkIds.
- If the chunks are insufficient to judge the prompt or response, set notFoundInSources=true, suggest failure, score 0 and explain the limitation.
- This output is only a suggestion. A human must confirm outcome and mistake type before evidence is saved.
- Return ONLY strict JSON matching the schema.

REVIEW STANDARD:
- Respond in ${language}.
- Evidence kind: ${input.kind ?? "explanation"}.
- For explanation, check whether the response accurately explains the concept and its important distinctions.
- For application, check whether the response correctly applies the concept to the prompt without unsupported assumptions.
- suggestedOutcome=success only when the central claim is source-supported and no major required point is wrong or missing.
- suggestedScore is 0–100 and must match the feedback.
- suggestedMistakeKind is only a suggestion. Use retrieval for inability to recall, confusion for mixing concepts, application for misuse in a case, careless only for a clearly superficial slip, otherwise unclassified.
- Prompt version: ${OPEN_ANSWER_REVIEW_PROMPT_VERSION}.

COURSE:
${input.course?.title ?? "(not supplied)"}
CONCEPT:
${input.concept?.title ?? "(not supplied)"}
CONCEPT DESCRIPTION:
${input.concept?.description ?? "(not supplied)"}
PROMPT:
${input.prompt ?? ""}
STUDENT RESPONSE:
${input.response ?? ""}

${repair}

SOURCE CHUNKS:
${chunks}`;
}

export async function runOpenAnswerReviewGeneration(
  input: OpenAnswerReviewGenerationInput,
): Promise<AIRouteResponse<OpenAnswerReviewDraft>> {
  if (!isGeminiConfigured()) return { ok: false, error: "AI is not configured" };
  const validationError = validateInput(input);
  if (validationError) return { ok: false, error: validationError };
  const prompt = input.prompt?.trim() ?? "";
  const responseText = input.response?.trim() ?? "";
  if (!input.concept?.id || !input.concept.title?.trim()) {
    return { ok: false, error: "A concept is required" };
  }
  if (!prompt) return { ok: false, error: "A prompt is required" };
  if (responseText.length < 8) return { ok: false, error: "The response is too short to review" };
  if (!input.chunks || input.chunks.length === 0) {
    return { ok: false, error: "Select at least one approved source chunk" };
  }
  if (!input.kind || !["explanation", "application"].includes(input.kind)) {
    return { ok: false, error: "Unsupported open-answer evidence kind" };
  }

  const generation = await generateGeminiJSON<unknown>(buildPrompt(input), SCHEMA);
  if (!generation.ok) {
    return { ok: false, error: generation.error, details: generation.details };
  }
  const normalized = normalizeOpenAnswerReview(
    generation.data,
    input.chunks.map((chunk) => chunk.id),
  );
  const model = getGeminiModelName();
  const requestedSourceChunkIds = input.chunks.map((chunk) => chunk.id);
  const rejectedSourceChunkIds = Array.from(
    new Set(
      (
        (generation.data as Record<string, unknown>)?.supportedSourceChunkIds as
          | unknown[]
          | undefined
      )
        ?.filter((value): value is string => typeof value === "string")
        .filter((id) => !requestedSourceChunkIds.includes(id)) ?? [],
    ),
  );
  const trust: AITrustMetadata = {
    model,
    promptVersion: OPEN_ANSWER_REVIEW_PROMPT_VERSION,
    requestedSourceChunkIds,
    rejectedSourceChunkIds,
    uncitedItemCount: normalized.supportedSourceChunkIds.length === 0 ? 1 : 0,
  };
  const draft: OpenAnswerReviewDraft = {
    ...normalized,
    feedback: normalized.feedback || formatOpenAnswerReviewSummary(normalized),
    trust,
  };
  return {
    ok: true,
    draft,
    model,
    promptVersion: OPEN_ANSWER_REVIEW_PROMPT_VERSION,
    warnings: draft.warnings,
    trust,
  };
}
