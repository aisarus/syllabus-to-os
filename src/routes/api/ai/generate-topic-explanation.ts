import { createFileRoute } from "@tanstack/react-router";
import { aiGenerationInputSchema } from "@/lib/server/ai-api-contract";
import { handleControlledAIJsonRequest } from "@/lib/server/ai-execution-http";
import { runAIGeneration } from "@/lib/server/ai-generation";

export const Route = createFileRoute("/api/ai/generate-topic-explanation")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        handleControlledAIJsonRequest(request, aiGenerationInputSchema, "topic", (body) =>
          runAIGeneration("topic", body),
        ),
    },
  },
});
