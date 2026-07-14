// SERVER-ONLY. Generates reviewable concept candidates from approved source chunks.

import type { ConceptCandidateDraft, ConceptExtractionDraft } from "../concept-extraction";
import {
  type AIGenerationInput,
  type AIRouteResponse,
  type AITrustMetadata,
  validateInput,
} from "./ai-generation";
import { generateGeminiJSON, getGeminiModelName, isGeminiConfigured } from "./gemini";

export const CONCEPT_EXTRACTION_PROMPT_VERSION = "concept-extraction-v1";

export interface ConceptExtractionGenerationInput extends AIGenerationInput {
  existingConceptTitles?: string[];
}

const SCHEMA = `{
  "candidates": Array<{
    "title": string,
    "description": string,
    "aliases": string[],
    "sourceChunkIds": string[]
  }>,
  "notFoundInSources": boolean,
  "warnings": string[]
}`;

function languageLabel(language?: string): string {
  return (
    { ru: "Russian", en: "English", he: "Hebrew", ar: "Arabic" }[
      language ?? "ru"
    ] || "Russian"
  );
}

function normalizeKey(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildPrompt(input: ConceptExtractionGenerationInput): string {
  const language = languageLabel(input.targetLanguage ?? input.locale ?? "ru");
  const existing = (input.existingConceptTitles ?? [])
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 200);
  const chunks = (input.chunks ?? [])
    .map(
      (chunk, index) =>
        `--- chunk #${index + 1} id=${chunk.id}${chunk.title ? ` title="${chunk.title}"` : ""}${chunk.pageNumber ? ` p.${chunk.pageNumber}` : ""} ---\n${chunk.text}`,
    )
    .join("\n\n");
  return `You extract academically useful concept candidates for a university knowledge map.

TRUST RULES:
- Use ONLY facts and terminology explicitly present in SOURCE CHUNKS.
- Never use model memory to add a concept, definition, alias, example, person, date or relationship.
- Every candidate must list one or more exact sourceChunkIds from the allowed ids.
- If a candidate lacks direct source support, omit it instead of guessing.
- Do not repeat or paraphrase an EXISTING CONCEPT.
- Return ONLY strict JSON matching the schema.

CONCEPT DESIGN:
- Respond in ${language}.
- Produce 4–16 atomic concepts when the source supports them.
- A concept should be a term, mechanism, doctrine, distinction, process or named analytical idea that is useful for recall and assessment.
- Avoid chapter titles, generic labels such as “introduction”, full sentences, trivia and overlapping synonyms.
- Keep the title concise.
- Write a one- or two-sentence source-grounded description.
- Add aliases only when the source itself visibly contains another name or language form.
- Preserve Hebrew academic terminology in the original form when useful.
- Set notFoundInSources=true when the selected source is too thin to produce reliable candidates.
- Prompt version: ${CONCEPT_EXTRACTION_PROMPT_VERSION}.

COURSE:
${input.course?.title ?? "(not supplied)"}
MATERIAL:
${input.material?.title ?? "(not supplied)"}
USER INSTRUCTIONS:
${input.instructions ?? "(none)"}
EXISTING CONCEPTS (do not duplicate):
${existing.length ? existing.map((value) => `- ${value}`).join("\n") : "(none)"}

SOURCE CHUNKS (allowed source ids only):
${chunks}`;
}

function normalizeDraft(
  raw: unknown,
  input: ConceptExtractionGenerationInput,
): {
  draft: ConceptExtractionDraft;
  rejectedSourceChunkIds: string[];
  uncitedItemCount: number;
} {
  const object = (raw ?? {}) as Record<string, unknown>;
  const allowed = new Set((input.chunks ?? []).map((chunk) => chunk.id));
  const existing = new Set(
    (input.existingConceptTitles ?? []).map(normalizeKey).filter(Boolean),
  );
  const rejected = new Set<string>();
  const warnings = Array.isArray(object.warnings)
    ? object.warnings.filter((value): value is string => typeof value === "string")
    : [];
  const seen = new Set<string>();
  let uncitedItemCount = 0;

  const candidates = (Array.isArray(object.candidates) ? object.candidates : [])
    .map((rawCandidate, index): ConceptCandidateDraft | null => {
      if (!rawCandidate || typeof rawCandidate !== "object" || Array.isArray(rawCandidate)) {
        return null;
      }
      const candidate = rawCandidate as Record<string, unknown>;
      const title = typeof candidate.title === "string" ? candidate.title.trim().slice(0, 240) : "";
      const description =
        typeof candidate.description === "string"
          ? candidate.description.trim().slice(0, 2_000)
          : "";
      const aliases = Array.from(
        new Set(
          (Array.isArray(candidate.aliases) ? candidate.aliases : [])
            .filter((value): value is string => typeof value === "string")
            .map((value) => value.trim().slice(0, 160))
            .filter(Boolean),
        ),
      ).slice(0, 8);
      const requestedIds = (Array.isArray(candidate.sourceChunkIds)
        ? candidate.sourceChunkIds
        : []
      ).filter((value): value is string => typeof value === "string");
      const sourceChunkIds = Array.from(new Set(requestedIds.filter((id) => allowed.has(id))));
      requestedIds.filter((id) => !allowed.has(id)).forEach((id) => rejected.add(id));
      const key = normalizeKey(title);
      if (!title || !description || !key || seen.has(key) || existing.has(key)) return null;
      if (sourceChunkIds.length === 0) {
        uncitedItemCount += 1;
        warnings.push(
          (input.locale ?? "ru") === "ru"
            ? `Кандидат ${index + 1} удалён: нет подтверждённого sourceChunkId.`
            : `Candidate ${index + 1} was removed because it had no validated sourceChunkId.`,
        );
        return null;
      }
      seen.add(key);
      return {
        title,
        description,
        aliases: aliases.filter((alias) => normalizeKey(alias) !== key),
        sourceChunkIds,
      };
    })
    .filter((value): value is ConceptCandidateDraft => Boolean(value))
    .slice(0, 20);

  const notFoundInSources = object.notFoundInSources === true || candidates.length === 0;
  if (notFoundInSources) {
    warnings.push(
      (input.locale ?? "ru") === "ru"
        ? "По выбранным источникам не удалось надёжно извлечь достаточно понятий."
        : "The selected sources did not support enough reliable concept candidates.",
    );
  }
  return {
    draft: {
      candidates,
      warnings: Array.from(new Set(warnings)),
      notFoundInSources,
    },
    rejectedSourceChunkIds: Array.from(rejected),
    uncitedItemCount,
  };
}

export async function runConceptExtractionGeneration(
  input: ConceptExtractionGenerationInput,
): Promise<AIRouteResponse<ConceptExtractionDraft>> {
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
  if (!response.ok) return { ok: false, error: response.error, details: response.details };

  const normalized = normalizeDraft(response.data, input);
  const model = getGeminiModelName();
  const trust: AITrustMetadata = {
    model,
    promptVersion: CONCEPT_EXTRACTION_PROMPT_VERSION,
    requestedSourceChunkIds: input.chunks.map((chunk) => chunk.id),
    rejectedSourceChunkIds: normalized.rejectedSourceChunkIds,
    uncitedItemCount: normalized.uncitedItemCount,
  };
  const draft = { ...normalized.draft, trust };
  return {
    ok: true,
    draft,
    model,
    promptVersion: CONCEPT_EXTRACTION_PROMPT_VERSION,
    warnings: draft.warnings,
    trust,
  };
}
