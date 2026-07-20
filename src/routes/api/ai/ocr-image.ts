import { createFileRoute } from "@tanstack/react-router";
import {
  handleAIJsonRequest,
  OCR_AI_JSON_BODY_BYTES,
  ocrGenerationInputSchema,
} from "@/lib/server/ai-api-contract";
import { runOCRGeneration } from "@/lib/server/ocr-generation";

export const Route = createFileRoute("/api/ai/ocr-image")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        handleAIJsonRequest(request, ocrGenerationInputSchema, runOCRGeneration, {
          maxBytes: OCR_AI_JSON_BODY_BYTES,
        }),
    },
  },
});
