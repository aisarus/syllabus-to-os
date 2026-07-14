import type { OpenAnswerReviewDraft } from "./open-answer-review";

export interface OpenAnswerReviewChunkInput {
  id: string;
  title?: string;
  text: string;
  pageNumber?: number;
  section?: string;
}

export interface OpenAnswerReviewRequest {
  locale: "ru" | "en";
  targetLanguage?: "ru" | "en" | "he" | "ar";
  course?: { id?: string; title?: string; number?: string } | null;
  material?: { id?: string; title?: string; type?: string } | null;
  concept: { id: string; title: string; description?: string };
  kind: "explanation" | "application";
  prompt: string;
  response: string;
  chunks: OpenAnswerReviewChunkInput[];
  repairContext?: {
    evidenceId: string;
    previousPrompt?: string;
    previousResponse?: string;
    previousMistakeKind?: string;
    previousReviewSummary?: string;
  };
}

export type OpenAnswerReviewResult =
  | { ok: true; data: OpenAnswerReviewDraft }
  | { ok: false; reason: "not_connected" | "invalid" | "error"; message: string };

export async function reviewOpenAnswer(
  input: OpenAnswerReviewRequest,
): Promise<OpenAnswerReviewResult> {
  try {
    const response = await fetch("/api/ai/review-open-answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const payload = (await response.json()) as {
      ok?: boolean;
      draft?: OpenAnswerReviewDraft;
      error?: string;
      warnings?: string[];
      trust?: OpenAnswerReviewDraft["trust"];
    };
    if (!response.ok || !payload.ok || !payload.draft) {
      const message = payload.error || `AI request failed (${response.status})`;
      return {
        ok: false,
        reason: /not configured/i.test(message)
          ? "not_connected"
          : response.status === 400
            ? "invalid"
            : "error",
        message,
      };
    }
    return {
      ok: true,
      data: {
        ...payload.draft,
        warnings: Array.from(
          new Set([...(payload.draft.warnings ?? []), ...(payload.warnings ?? [])]),
        ),
        trust: payload.draft.trust ?? payload.trust,
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
