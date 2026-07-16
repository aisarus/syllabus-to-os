import { createFileRoute } from "@tanstack/react-router";
import {
  MAX_AUTOMATIC_TRANSCRIPTION_BYTES,
  validateAutomaticTranscriptionFile,
} from "@/lib/automatic-transcription";
import { transcribeWithConfiguredProvider } from "@/lib/server/automatic-transcription-provider";

export const Route = createFileRoute("/api/ai/transcribe-long-media")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return Response.json({ ok: false, error: "Invalid multipart form body." }, { status: 400 });
        }

        const file = form.get("file");
        const materialId = stringValue(form.get("materialId"));
        const sourceUploadId = stringValue(form.get("sourceUploadId"));
        const durationSeconds = numberValue(form.get("durationSeconds"));
        const language = normalizeLanguage(stringValue(form.get("language")));
        const requestSpeakerLabels = stringValue(form.get("requestSpeakerLabels")) !== "false";

        if (!(file instanceof File)) {
          return Response.json({ ok: false, error: "A media file is required." }, { status: 400 });
        }
        if (!materialId || !sourceUploadId) {
          return Response.json(
            { ok: false, error: "materialId and sourceUploadId are required." },
            { status: 400 },
          );
        }
        const validation = validateAutomaticTranscriptionFile(file, MAX_AUTOMATIC_TRANSCRIPTION_BYTES);
        if (!validation.ok) {
          return Response.json({ ok: false, error: validation.message }, { status: 413 });
        }

        const result = await transcribeWithConfiguredProvider({
          file,
          language,
          requestSpeakerLabels,
          durationSeconds,
          signal: request.signal,
        });
        const status = result.ok ? 200 : /not configured/i.test(result.error ?? "") ? 503 : 502;
        return Response.json(
          {
            ...result,
            materialId,
            sourceUploadId,
          },
          { status },
        );
      },
    },
  },
});

function stringValue(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: FormDataEntryValue | null): number | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function normalizeLanguage(value: string): string | undefined {
  if (!value || value === "auto") return undefined;
  return /^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(value) ? value : undefined;
}
