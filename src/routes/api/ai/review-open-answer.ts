import { createFileRoute } from "@tanstack/react-router";
import { handleAIJSONRequest } from "@/lib/server/ai-route-policy";
import { openAnswerReviewInputSchema } from "@/lib/server/ai-route-schemas";
import { runOpenAnswerReviewGeneration } from "@/lib/server/open-answer-review-generation";

export const Route = createFileRoute("/api/ai/review-open-answer")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        handleAIJSONRequest(request, {
          operation: "review-open-answer",
          schema: openAnswerReviewInputSchema,
          costUnits: 3,
          handler: (body) => runOpenAnswerReviewGeneration(body),
        }),
    },
  },
});
