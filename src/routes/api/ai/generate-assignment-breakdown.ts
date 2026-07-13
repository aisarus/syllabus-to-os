import { createFileRoute } from "@tanstack/react-router";
import { runAIGeneration, type AIGenerationInput } from "@/lib/server/ai-generation";

export const Route = createFileRoute("/api/ai/generate-assignment-breakdown")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: AIGenerationInput;
        try {
          body = (await request.json()) as AIGenerationInput;
        } catch {
          return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
        }
        return Response.json(await runAIGeneration("assignment", body));
      },
    },
  },
});
