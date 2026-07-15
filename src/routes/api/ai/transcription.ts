import { createFileRoute } from "@tanstack/react-router";
import {
  deleteGeminiFile,
  getGeminiTranscriptionStatus,
  startGeminiResumableUpload,
  transcribeGeminiRange,
  uploadGeminiChunk,
  type GeminiRangeInput,
  type StartGeminiUploadInput,
} from "@/lib/server/gemini-transcription";

const CONSENT_HEADER = "google-gemini-files-v1";

export const Route = createFileRoute("/api/ai/transcription")({
  server: {
    handlers: {
      GET: async () => Response.json({ ok: true, data: getGeminiTranscriptionStatus() }),
      POST: async ({ request }) => {
        const action = new URL(request.url).searchParams.get("action");
        if (!action) {
          return Response.json({ ok: false, error: "Missing transcription action." }, { status: 400 });
        }
        if (action !== "delete" && request.headers.get("x-lamdan-external-upload-consent") !== CONSENT_HEADER) {
          return Response.json(
            {
              ok: false,
              error: "Explicit Google Gemini upload consent is required for this operation.",
            },
            { status: 412 },
          );
        }

        if (action === "start") {
          const body = await readJSON<StartGeminiUploadInput>(request);
          if (!body.ok) return body.response;
          return resultResponse(await startGeminiResumableUpload(body.data));
        }

        if (action === "chunk") {
          const uploadUrl = request.headers.get("x-lamdan-upload-url") ?? "";
          const offset = Number(request.headers.get("x-lamdan-upload-offset"));
          const commandHeader = request.headers.get("x-lamdan-upload-command");
          const command = commandHeader === "upload, finalize" ? "upload, finalize" : "upload";
          const result = await uploadGeminiChunk({
            uploadUrl,
            offset,
            command,
            body: await request.arrayBuffer(),
          });
          return resultResponse(result);
        }

        if (action === "range") {
          const body = await readJSON<GeminiRangeInput>(request);
          if (!body.ok) return body.response;
          return resultResponse(await transcribeGeminiRange(body.data));
        }

        if (action === "delete") {
          const body = await readJSON<{ fileName?: string }>(request);
          if (!body.ok) return body.response;
          return resultResponse(await deleteGeminiFile(body.data.fileName ?? ""));
        }

        return Response.json({ ok: false, error: "Unknown transcription action." }, { status: 404 });
      },
    },
  },
});

async function readJSON<T>(
  request: Request,
): Promise<{ ok: true; data: T } | { ok: false; response: Response }> {
  try {
    return { ok: true, data: (await request.json()) as T };
  } catch {
    return {
      ok: false,
      response: Response.json({ ok: false, error: "Invalid JSON body." }, { status: 400 }),
    };
  }
}

function resultResponse<T>(result: { ok: true; data: T } | { ok: false; error: string; details?: string; status?: number }): Response {
  return Response.json(result, { status: result.ok ? 200 : result.status ?? 400 });
}
