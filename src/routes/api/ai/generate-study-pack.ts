import { createFileRoute } from "@tanstack/react-router";
import { aiGenerationInputSchema } from "@/lib/server/ai-api-contract";
import { handleControlledAIJsonRequest } from "@/lib/server/ai-execution-http";
import { runStudyPackGeneration } from "@/lib/server/study-pack-generation";

export const Route = createFileRoute("/api/ai/generate-study-pack")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        handleControlledAIJsonRequest(
          request,
          aiGenerationInputSchema,
          "study-pack",
          runStudyPackGeneration,
        ),
    },
  },
});
