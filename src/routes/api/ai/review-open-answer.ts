import { createFileRoute } from "@tanstack/react-router";
import {
  runOpenAnswerReviewGeneration,
  type OpenAnswerReviewGenerationInput,
} from "@/lib/server/open-answer-review-generation";

export const Route = createFileRoute("/api/ai/review-open-answer")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: OpenAnswerReviewGenerationInput;
        try {
          body = (await request.json()) as OpenAnswerReviewGenerationInput;
        } catch {
          return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
        }
        const result = await runOpenAnswerReviewGeneration(body);
        return Response.json(result, { status: result.ok ? 200 : 400 });
      },
    },
  },
});
