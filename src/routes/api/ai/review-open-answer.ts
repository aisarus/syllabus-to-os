import { createFileRoute } from "@tanstack/react-router";
import { handleAIJsonRequest, openAnswerReviewInputSchema } from "@/lib/server/ai-api-contract";
import { runOpenAnswerReviewGeneration } from "@/lib/server/open-answer-review-generation";

export const Route = createFileRoute("/api/ai/review-open-answer")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        handleAIJsonRequest(request, openAnswerReviewInputSchema, runOpenAnswerReviewGeneration),
    },
  },
});
