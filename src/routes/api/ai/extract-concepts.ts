import { createFileRoute } from "@tanstack/react-router";
import { handleAIJSONRequest } from "@/lib/server/ai-route-policy";
import { conceptExtractionInputSchema } from "@/lib/server/ai-route-schemas";
import { runConceptExtractionGeneration } from "@/lib/server/concept-extraction-generation";

export const Route = createFileRoute("/api/ai/extract-concepts")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        handleAIJSONRequest(request, {
          operation: "extract-concepts",
          schema: conceptExtractionInputSchema,
          costUnits: 4,
          handler: (body) => runConceptExtractionGeneration(body),
        }),
    },
  },
});
