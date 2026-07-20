import { createFileRoute } from "@tanstack/react-router";
import { createAIRequestId, withAIExecutionHeaders } from "@/lib/server/ai-execution-control";
import { getAutomaticTranscriptionProviderStatus } from "@/lib/server/automatic-transcription-provider";

export const Route = createFileRoute("/api/ai/transcription-status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const requestId = createAIRequestId(request);
        return withAIExecutionHeaders(Response.json(getAutomaticTranscriptionProviderStatus()), {
          requestId,
          replayed: false,
        });
      },
    },
  },
});
