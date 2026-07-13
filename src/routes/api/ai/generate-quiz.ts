import { createFileRoute } from "@tanstack/react-router";
import { type AIGenerationInput } from "@/lib/server/ai-generation";
import { runGoldenQuizGeneration } from "@/lib/server/golden-quiz-generation";

export const Route = createFileRoute("/api/ai/generate-quiz")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: AIGenerationInput;
        try {
          body = (await request.json()) as AIGenerationInput;
        } catch {
          return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
        }
        return Response.json(await runGoldenQuizGeneration(body));
      },
    },
  },
});
