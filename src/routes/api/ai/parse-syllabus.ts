import { createFileRoute } from "@tanstack/react-router";

// POST /api/ai/parse-syllabus
// Uses Google Gemini API to refine a deterministic syllabus draft.
// Never exposes GEMINI_API_KEY to the frontend.

interface Body {
  fileName?: string;
  sheets?: { name: string; rows: string[][] }[];
  deterministicDraft?: unknown;
  ignoredRows?: unknown;
  locale?: "ru" | "en";
}

const SYSTEM_INSTRUCTION = `You are parsing an Israeli academic syllabus/program table.
Return only strict JSON matching the ParsedSyllabusDraft schema provided in the user message.
Do not invent courses. Do not invent credits. Do not invent instructors.
Skip header rows, section rows, total rows, and notes.
Preserve Hebrew course titles exactly.
Group courses by detected year and semester.
If unsure, include a warning and lower confidence.
Every course must include source sheet and row index.
Never translate course titles unless a translated field exists in the source.`;

export const Route = createFileRoute("/api/ai/parse-syllabus")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.GEMINI_API_KEY;
        const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
        if (!key) {
          return Response.json({ ok: false, error: "Gemini parser is not configured" }, { status: 200 });
        }

        let body: Body;
        try {
          body = (await request.json()) as Body;
        } catch {
          return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
        }

        // Compact sheets: trim very large payloads to stay under model limits.
        const sheets = (body.sheets ?? []).map((s) => ({
          name: s.name,
          rows: (s.rows ?? []).slice(0, 400).map((r) => r.slice(0, 20)),
        }));

        const userPayload = {
          fileName: body.fileName ?? "",
          locale: body.locale ?? "ru",
          deterministicDraft: body.deterministicDraft ?? null,
          ignoredRows: body.ignoredRows ?? [],
          sheets,
        };

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;

        try {
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
              contents: [
                {
                  role: "user",
                  parts: [
                    { text: "Refine the deterministic syllabus draft below. Return ONLY a JSON object matching ParsedSyllabusDraft: { id, sourceFileName, parserVersion, parserType: 'ai_assisted', confidence, institution?, programName?, degree?, warnings[], semesters[], courses[], ignoredRows[], stats }. Input follows:" },
                    { text: "```json\n" + JSON.stringify(userPayload) + "\n```" },
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.1,
                responseMimeType: "application/json",
              },
            }),
          });

          if (!res.ok) {
            const errText = await res.text();
            console.error(`Gemini request failed [${res.status}]: ${errText}`);
            return Response.json(
              { ok: false, error: `Gemini API error [${res.status}]` },
              { status: 200 },
            );
          }
          const j = (await res.json()) as {
            candidates?: { content?: { parts?: { text?: string }[] } }[];
          };
          const text = j.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
          if (!text) return Response.json({ ok: false, error: "Empty Gemini response" }, { status: 200 });
          let draft: unknown;
          try {
            draft = JSON.parse(text);
          } catch {
            return Response.json({ ok: false, error: "Gemini returned non-JSON output" }, { status: 200 });
          }
          return Response.json({ ok: true, draft });
        } catch (e) {
          console.error("Gemini call failed:", e);
          return Response.json({ ok: false, error: (e as Error).message }, { status: 200 });
        }
      },
    },
  },
});
