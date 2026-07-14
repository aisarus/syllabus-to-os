import { createFileRoute } from "@tanstack/react-router";
import {
  runConceptExtractionGeneration,
  type ConceptExtractionGenerationInput,
} from "@/lib/server/concept-extraction-generation";

export const Route = createFileRoute("/api/ai/extract-concepts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: ConceptExtractionGenerationInput;
        try {
          body = (await request.json()) as ConceptExtractionGenerationInput;
        } catch {
          return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
        }
        const result = await runConceptExtractionGeneration(body);
        return Response.json(result, { status: result.ok ? 200 : 400 });
      },
    },
  },
});
