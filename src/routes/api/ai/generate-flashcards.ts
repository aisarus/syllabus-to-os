import { createFileRoute } from "@tanstack/react-router";
import { runAIGeneration } from "@/lib/server/ai-generation";
import { handleAIJSONRequest } from "@/lib/server/ai-route-policy";
import { aiGenerationInputSchema } from "@/lib/server/ai-route-schemas";

export const Route = createFileRoute("/api/ai/generate-flashcards")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        handleAIJSONRequest(request, {
          operation: "generate-flashcards",
          schema: aiGenerationInputSchema,
          costUnits: 3,
          handler: (body, context) => runAIGeneration("flashcards", body, context),
        }),
    },
  },
});
