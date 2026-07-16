import { createFileRoute } from "@tanstack/react-router";
import { getAutomaticTranscriptionProviderStatus } from "@/lib/server/automatic-transcription-provider";

export const Route = createFileRoute("/api/ai/transcription-status")({
  server: {
    handlers: {
      GET: async () => Response.json(getAutomaticTranscriptionProviderStatus()),
    },
  },
});
