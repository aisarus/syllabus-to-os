import { createFileRoute } from "@tanstack/react-router";
import { runAIGeneration } from "@/lib/server/ai-generation";
import { handleAIJSONRequest } from "@/lib/server/ai-route-policy";
import { aiGenerationInputSchema } from "@/lib/server/ai-route-schemas";

export const Route = createFileRoute("/api/ai/generate-assignment-breakdown")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        handleAIJSONRequest(request, {
          operation: "generate-assignment-breakdown",
          schema: aiGenerationInputSchema,
          costUnits: 2,
          handler: (body, context) => runAIGeneration("assignment", body, context),
        }),
    },
  },
});
