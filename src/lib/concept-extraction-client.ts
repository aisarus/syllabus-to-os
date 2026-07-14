import type { ConceptExtractionDraft } from "./concept-extraction";

export interface ConceptExtractionChunkInput {
  id: string;
  title?: string;
  text: string;
  pageNumber?: number;
  section?: string;
}

export interface ConceptExtractionInput {
  locale: "ru" | "en";
  targetLanguage?: "ru" | "en" | "he" | "ar";
  course?: { id?: string; title?: string; number?: string } | null;
  material?: { id?: string; title?: string; type?: string } | null;
  chunks: ConceptExtractionChunkInput[];
  existingConceptTitles: string[];
  instructions?: string;
}

export type ConceptExtractionResult =
  | { ok: true; data: ConceptExtractionDraft }
  | { ok: false; reason: "not_connected" | "error" | "invalid"; message: string };

export async function generateConceptCandidatesDraft(
  input: ConceptExtractionInput,
): Promise<ConceptExtractionResult> {
  try {
    const response = await fetch("/api/ai/extract-concepts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const payload = (await response.json()) as {
      ok?: boolean;
      draft?: ConceptExtractionDraft;
      error?: string;
      model?: string;
      promptVersion?: string;
      warnings?: string[];
      trust?: ConceptExtractionDraft["trust"];
    };
    if (!response.ok || !payload.ok || !payload.draft) {
      const error = payload.error || `AI request failed (${response.status})`;
      return {
        ok: false,
        reason: /not configured/i.test(error)
          ? "not_connected"
          : response.status === 400
            ? "invalid"
            : "error",
        message: error,
      };
    }
    return {
      ok: true,
      data: {
        ...payload.draft,
        warnings: Array.from(
          new Set([...(payload.draft.warnings ?? []), ...(payload.warnings ?? [])]),
        ),
        trust:
          payload.draft.trust ??
          payload.trust ??
          (payload.model && payload.promptVersion
            ? {
                model: payload.model,
                promptVersion: payload.promptVersion,
                requestedSourceChunkIds: input.chunks.map((chunk) => chunk.id),
                rejectedSourceChunkIds: [],
                uncitedItemCount: 0,
              }
            : undefined),
      },
    };
  } catch (error) {
    return {
      ok: false,
      reason: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
