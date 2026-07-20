import { createFileRoute } from "@tanstack/react-router";
import {
  MAX_AUTOMATIC_TRANSCRIPTION_BYTES,
  validateAutomaticTranscriptionFile,
} from "@/lib/automatic-transcription";
import {
  aiErrorResponse,
  aiResultResponse,
  formatAIValidationDetails,
  parseAIFormDataRequest,
  safeAIInternalErrorResponse,
  TRANSCRIPTION_FORM_BODY_BYTES,
  transcriptionMetadataSchema,
} from "@/lib/server/ai-api-contract";
import {
  AIExecutionError,
  aiExecutionErrorResponse,
  createAIRequestId,
  executeAIRequest,
  readIdempotencyKey,
  withAIExecutionHeaders,
} from "@/lib/server/ai-execution-control";
import { transcribeWithConfiguredProvider } from "@/lib/server/automatic-transcription-provider";

export const Route = createFileRoute("/api/ai/transcribe-long-media")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const requestId = createAIRequestId(request);
        const parsedForm = await parseAIFormDataRequest(request, {
          maxBytes: TRANSCRIPTION_FORM_BODY_BYTES,
        });
        if (!parsedForm.ok) {
          return withAIExecutionHeaders(parsedForm.response, { requestId, replayed: false });
        }
        const form = parsedForm.data;
        const file = form.get("file");

        if (!(file instanceof File)) {
          return withAIExecutionHeaders(
            aiErrorResponse("INVALID_INPUT", "A media file is required.", 400),
            { requestId, replayed: false },
          );
        }

        const metadata = transcriptionMetadataSchema.safeParse({
          materialId: stringValue(form.get("materialId")),
          sourceUploadId: stringValue(form.get("sourceUploadId")),
          durationSeconds: numberValue(form.get("durationSeconds")),
          language: normalizeLanguage(stringValue(form.get("language"))),
          requestSpeakerLabels: stringValue(form.get("requestSpeakerLabels")) !== "false",
        });
        if (!metadata.success) {
          return withAIExecutionHeaders(
            aiErrorResponse(
              "INVALID_INPUT",
              "Transcription metadata does not match the expected schema.",
              400,
              formatAIValidationDetails(metadata.error.issues),
            ),
            { requestId, replayed: false },
          );
        }

        const validation = validateAutomaticTranscriptionFile(
          file,
          MAX_AUTOMATIC_TRANSCRIPTION_BYTES,
        );
        if (!validation.ok) {
          return withAIExecutionHeaders(
            aiErrorResponse("PAYLOAD_TOO_LARGE", validation.message, 413),
            { requestId, replayed: false },
          );
        }

        try {
          const execution = await executeAIRequest({
            operation: "transcription",
            input: {
              name: file.name,
              size: file.size,
              type: file.type,
              metadata: metadata.data,
            },
            idempotencyKey: readIdempotencyKey(request),
            estimatedCost: Math.max(1, Math.ceil(file.size / 1_000_000)),
            dependencies: { createRequestId: () => requestId },
            handler: async () => {
              const result = await transcribeWithConfiguredProvider({
                file,
                language: metadata.data.language,
                requestSpeakerLabels: metadata.data.requestSpeakerLabels,
                durationSeconds: metadata.data.durationSeconds,
                signal: request.signal,
              });
              return {
                ...result,
                materialId: metadata.data.materialId,
                sourceUploadId: metadata.data.sourceUploadId,
              };
            },
          });
          return withAIExecutionHeaders(aiResultResponse(execution.value), execution);
        } catch (error) {
          if (error instanceof AIExecutionError) return aiExecutionErrorResponse(error, requestId);
          return withAIExecutionHeaders(safeAIInternalErrorResponse(), {
            requestId,
            replayed: false,
          });
        }
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
