import { createFileRoute } from "@tanstack/react-router";
import { handleAIJSONRequest } from "@/lib/server/ai-route-policy";
import { aiGenerationInputSchema } from "@/lib/server/ai-route-schemas";
import { runStudyPackGeneration } from "@/lib/server/study-pack-generation";

export const Route = createFileRoute("/api/ai/generate-study-pack")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        handleAIJSONRequest(request, {
          operation: "generate-study-pack",
          schema: aiGenerationInputSchema,
          costUnits: 5,
          handler: (body) => runStudyPackGeneration(body),
        }),
    },
  },
});
