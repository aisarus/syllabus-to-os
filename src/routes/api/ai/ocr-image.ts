import { createFileRoute } from "@tanstack/react-router";
import {
  runOCRGeneration,
  type OCRGenerationInput,
} from "@/lib/server/ocr-generation";

export const Route = createFileRoute("/api/ai/ocr-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: OCRGenerationInput;
        try {
          body = (await request.json()) as OCRGenerationInput;
        } catch {
          return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
        }
        const result = await runOCRGeneration(body);
        return Response.json(result, { status: result.ok ? 200 : 400 });
      },
    },
  },
});
