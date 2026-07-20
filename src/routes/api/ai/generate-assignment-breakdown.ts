import { createFileRoute } from "@tanstack/react-router";
import { aiGenerationInputSchema, handleAIJsonRequest } from "@/lib/server/ai-api-contract";
import { runAIGeneration } from "@/lib/server/ai-generation";

export const Route = createFileRoute("/api/ai/generate-assignment-breakdown")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        handleAIJsonRequest(request, aiGenerationInputSchema, (body) =>
          runAIGeneration("assignment", body),
        ),
    },
  },
});
