import { createFileRoute } from "@tanstack/react-router";
import { handleAIJSONRequest } from "@/lib/server/ai-route-policy";
import { ocrGenerationInputSchema } from "@/lib/server/ai-route-schemas";
import { runOCRGeneration } from "@/lib/server/ocr-generation";

export const Route = createFileRoute("/api/ai/ocr-image")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        handleAIJSONRequest(request, {
          operation: "ocr-image",
          schema: ocrGenerationInputSchema,
          maxBodyBytes: 13_000_000,
          costUnits: 6,
          handler: (body, context) => runOCRGeneration(body, context),
        }),
    },
  },
});
