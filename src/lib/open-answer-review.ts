import type {
  ConceptEvidenceKind,
  ConceptEvidenceOutcome,
  ConceptMistakeKind,
} from "./concept-evidence";

export interface OpenAnswerReviewDraft {
  suggestedOutcome: Extract<ConceptEvidenceOutcome, "success" | "failure">;
  suggestedScore: number;
  feedback: string;
  strengths: string[];
  missingPoints: string[];
  suggestedMistakeKind: ConceptMistakeKind;
  supportedSourceChunkIds: string[];
  warnings: string[];
  notFoundInSources: boolean;
  trust?: {
    model: string;
    promptVersion: string;
    requestedSourceChunkIds: string[];
    rejectedSourceChunkIds: string[];
    uncitedItemCount: number;
  };
}

export interface OpenAnswerReviewInput {
  conceptId: string;
  conceptTitle: string;
  conceptDescription?: string;
  kind: Extract<ConceptEvidenceKind, "explanation" | "application">;
  prompt: string;
  response: string;
  sourceChunkIds: string[];
  repairOfEvidenceId?: string;
}

export interface OpenAnswerSaveDraft extends OpenAnswerReviewInput {
  outcome: Extract<ConceptEvidenceOutcome, "success" | "failure">;
  mistakeKind?: ConceptMistakeKind;
  score?: number;
  reviewSummary?: string;
  reviewMode: "human" | "ai_human";
}

const MISTAKES: ConceptMistakeKind[] = [
  "retrieval",
  "confusion",
  "application",
  "careless",
  "unclassified",
];

export function normalizeOpenAnswerReview(
  raw: unknown,
  allowedSourceChunkIds: Iterable<string>,
): OpenAnswerReviewDraft {
  const object =
    raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const allowed = new Set(allowedSourceChunkIds);
  const requestedIds = Array.isArray(object.supportedSourceChunkIds)
    ? object.supportedSourceChunkIds.filter((value): value is string => typeof value === "string")
    : [];
  const supportedSourceChunkIds = Array.from(new Set(requestedIds.filter((id) => allowed.has(id))));
  const outcome = object.suggestedOutcome === "success" ? "success" : "failure";
  const rawMistake =
    typeof object.suggestedMistakeKind === "string" ? object.suggestedMistakeKind : "unclassified";
  const warnings = stringArray(object.warnings);
  const notFoundInSources =
    object.notFoundInSources === true || supportedSourceChunkIds.length === 0;
  if (notFoundInSources) {
    warnings.push("The selected sources were insufficient for a grounded review.");
  }
  return {
    suggestedOutcome: notFoundInSources ? "failure" : outcome,
    suggestedScore: clampScore(object.suggestedScore),
    feedback: text(object.feedback).slice(0, 4_000),
    strengths: stringArray(object.strengths).slice(0, 12),
    missingPoints: stringArray(object.missingPoints).slice(0, 12),
    suggestedMistakeKind: MISTAKES.includes(rawMistake as ConceptMistakeKind)
      ? (rawMistake as ConceptMistakeKind)
      : "unclassified",
    supportedSourceChunkIds,
    warnings: Array.from(new Set(warnings)),
    notFoundInSources,
  };
}

export function validateOpenAnswerSaveDraft(
  draft: OpenAnswerSaveDraft,
  allowedSourceChunkIds: Iterable<string>,
): { ok: true; normalized: OpenAnswerSaveDraft } | { ok: false; error: string } {
  const allowed = new Set(allowedSourceChunkIds);
  const prompt = draft.prompt.trim().slice(0, 2_000);
  const response = draft.response.trim().slice(0, 12_000);
  const sourceChunkIds = Array.from(new Set(draft.sourceChunkIds.filter((id) => allowed.has(id))));
  if (!draft.conceptId || !draft.conceptTitle.trim()) {
    return { ok: false, error: "A concept is required." };
  }
  if (!prompt) return { ok: false, error: "A prompt is required." };
  if (response.length < 8) return { ok: false, error: "The answer is too short to review." };
  if (sourceChunkIds.length === 0) {
    return { ok: false, error: "At least one current concept source is required." };
  }
  const score = draft.score === undefined ? undefined : clampScore(draft.score);
  return {
    ok: true,
    normalized: {
      ...draft,
      conceptTitle: draft.conceptTitle.trim().slice(0, 240),
      conceptDescription: draft.conceptDescription?.trim().slice(0, 2_000) || undefined,
      prompt,
      response,
      sourceChunkIds,
      score,
      mistakeKind:
        draft.outcome === "failure"
          ? MISTAKES.includes(draft.mistakeKind ?? "unclassified")
            ? (draft.mistakeKind ?? "unclassified")
            : "unclassified"
          : undefined,
      reviewSummary: draft.reviewSummary?.trim().slice(0, 4_000) || undefined,
    },
  };
}

export function formatOpenAnswerReviewSummary(review: OpenAnswerReviewDraft): string {
  const sections = [review.feedback.trim()];
  if (review.strengths.length > 0) {
    sections.push(`Strengths: ${review.strengths.join("; ")}`);
  }
  if (review.missingPoints.length > 0) {
    sections.push(`Missing: ${review.missingPoints.join("; ")}`);
  }
  if (review.warnings.length > 0) {
    sections.push(`Warnings: ${review.warnings.join("; ")}`);
  }
  return sections.filter(Boolean).join("\n").slice(0, 4_000);
}

function clampScore(value: unknown): number {
  const number = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? Array.from(
        new Set(
          value
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim())
            .filter(Boolean),
        ),
      )
    : [];
}
