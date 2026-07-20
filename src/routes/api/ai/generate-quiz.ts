import { createFileRoute } from "@tanstack/react-router";
import { aiGenerationInputSchema } from "@/lib/server/ai-api-contract";
import { handleControlledAIJsonRequest } from "@/lib/server/ai-execution-http";
import { runGoldenQuizGeneration } from "@/lib/server/golden-quiz-generation";

export const Route = createFileRoute("/api/ai/generate-quiz")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        handleControlledAIJsonRequest(
          request,
          aiGenerationInputSchema,
          "quiz",
          runGoldenQuizGeneration,
        ),
    },
  },
});
