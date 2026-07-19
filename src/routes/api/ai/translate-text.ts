import { createFileRoute } from "@tanstack/react-router";
import { runAIGeneration } from "@/lib/server/ai-generation";
import { handleAIJSONRequest } from "@/lib/server/ai-route-policy";
import { aiGenerationInputSchema } from "@/lib/server/ai-route-schemas";

export const Route = createFileRoute("/api/ai/translate-text")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        handleAIJSONRequest(request, {
          operation: "translate-text",
          schema: aiGenerationInputSchema,
          costUnits: 1,
          handler: (body, context) => runAIGeneration("translate", body, context),
        }),
    },
  },
});
