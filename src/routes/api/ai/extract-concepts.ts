import { createFileRoute } from "@tanstack/react-router";
import { conceptExtractionInputSchema } from "@/lib/server/ai-api-contract";
import { handleControlledAIJsonRequest } from "@/lib/server/ai-execution-http";
import { runConceptExtractionGeneration } from "@/lib/server/concept-extraction-generation";

export const Route = createFileRoute("/api/ai/extract-concepts")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        handleControlledAIJsonRequest(
          request,
          conceptExtractionInputSchema,
          "concept-extraction",
          runConceptExtractionGeneration,
        ),
    },
  },
});
