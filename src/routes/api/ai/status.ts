import { createFileRoute } from "@tanstack/react-router";
import { createAIRequestId, withAIExecutionHeaders } from "@/lib/server/ai-execution-control";
import { getGeminiModelName, isGeminiConfigured } from "@/lib/server/gemini";

export const Route = createFileRoute("/api/ai/status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const requestId = createAIRequestId(request);
        const configured = isGeminiConfigured();
        return withAIExecutionHeaders(
          Response.json({
            ok: true,
            provider: "lovable-ai-gateway",
            configured,
            model: configured ? getGeminiModelName() : null,
          }),
          { requestId, replayed: false },
        );
      },
    },
  },
});
