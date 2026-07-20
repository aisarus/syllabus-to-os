import { createFileRoute } from "@tanstack/react-router";
import { conceptExtractionInputSchema, handleAIJsonRequest } from "@/lib/server/ai-api-contract";
import { runConceptExtractionGeneration } from "@/lib/server/concept-extraction-generation";

export const Route = createFileRoute("/api/ai/extract-concepts")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        handleAIJsonRequest(request, conceptExtractionInputSchema, runConceptExtractionGeneration),
    },
  },
});
