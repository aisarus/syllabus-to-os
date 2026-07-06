import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/ai/status")({
  server: {
    handlers: {
      GET: async () => {
        const key = process.env.GEMINI_API_KEY;
        const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
        return Response.json({
          configured: Boolean(key),
          provider: "gemini",
          model: key ? model : undefined,
        });
      },
    },
  },
});
