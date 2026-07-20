import { createFileRoute } from "@tanstack/react-router";
import { aiGenerationInputSchema, handleAIJsonRequest } from "@/lib/server/ai-api-contract";
import { runStudyPackGeneration } from "@/lib/server/study-pack-generation";

export const Route = createFileRoute("/api/ai/generate-study-pack")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        handleAIJsonRequest(request, aiGenerationInputSchema, runStudyPackGeneration),
    },
  },
});
