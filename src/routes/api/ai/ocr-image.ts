import { createFileRoute } from "@tanstack/react-router";
import { OCR_AI_JSON_BODY_BYTES, ocrGenerationInputSchema } from "@/lib/server/ai-api-contract";
import { handleControlledAIJsonRequest } from "@/lib/server/ai-execution-http";
import { runOCRGeneration } from "@/lib/server/ocr-generation";

export const Route = createFileRoute("/api/ai/ocr-image")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        handleControlledAIJsonRequest(request, ocrGenerationInputSchema, "ocr", runOCRGeneration, {
          maxBytes: OCR_AI_JSON_BODY_BYTES,
        }),
    },
  },
});
