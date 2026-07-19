import { createFileRoute } from "@tanstack/react-router";
import { runAIGeneration } from "@/lib/server/ai-generation";
import { handleAIJSONRequest } from "@/lib/server/ai-route-policy";
import { aiGenerationInputSchema } from "@/lib/server/ai-route-schemas";

export const Route = createFileRoute("/api/ai/generate-quiz")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        handleAIJSONRequest(request, {
          operation: "generate-quiz",
          schema: aiGenerationInputSchema,
          costUnits: 4,
          handler: (body, context) => runAIGeneration("quiz", body, context),
        }),
    },
  },
});
