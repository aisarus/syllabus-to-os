import { createFileRoute } from "@tanstack/react-router";
import { aiGenerationInputSchema, handleAIJsonRequest } from "@/lib/server/ai-api-contract";
import { runGoldenQuizGeneration } from "@/lib/server/golden-quiz-generation";

export const Route = createFileRoute("/api/ai/generate-quiz")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        handleAIJsonRequest(request, aiGenerationInputSchema, runGoldenQuizGeneration),
    },
  },
});
