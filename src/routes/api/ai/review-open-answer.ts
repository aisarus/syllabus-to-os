import { createFileRoute } from "@tanstack/react-router";
import { openAnswerReviewInputSchema } from "@/lib/server/ai-api-contract";
import { handleControlledAIJsonRequest } from "@/lib/server/ai-execution-http";
import { runOpenAnswerReviewGeneration } from "@/lib/server/open-answer-review-generation";

export const Route = createFileRoute("/api/ai/review-open-answer")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        handleControlledAIJsonRequest(
          request,
          openAnswerReviewInputSchema,
          "open-answer-review",
          runOpenAnswerReviewGeneration,
        ),
    },
  },
});
