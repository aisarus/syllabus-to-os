import { createFileRoute } from "@tanstack/react-router";
import { getGeminiModelName, isGeminiConfigured } from "@/lib/server/gemini";

export const Route = createFileRoute("/api/ai/status")({
  server: {
    handlers: {
      GET: async () => {
        const configured = isGeminiConfigured();
        return Response.json({
          ok: true,
          provider: "google-gemini",
          configured,
          model: configured ? getGeminiModelName() : null,
        });
      },
    },
  },
});
