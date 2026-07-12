import { createFileRoute } from "@tanstack/react-router";
import {
  COURSE_SYLLABUS_DRAFT_VERSION,
  normalizeCourseSyllabusDraft,
  type CourseSyllabusDraft,
} from "@/lib/course-syllabus";
import {
  generateGeminiJSON,
  getGeminiModelName,
  isGeminiConfigured,
} from "@/lib/server/gemini";

interface Body {
  fileName?: string;
  rawText?: string;
  locale?: "ru" | "en";
  deterministicDraft?: CourseSyllabusDraft;
}

const MAX_TEXT_CHARS = 45_000;
const PROMPT_VERSION = "course-syllabus-review-v1";

const SCHEMA = `{
  "id": string,
  "version": "course-syllabus-v1",
  "parserType": "ai_assisted",
  "sourceFileName": string,
  "sourceLanguage"?: string,
  "title": string,
  "number"?: string,
  "instructor"?: string,
  "credits"?: number,
  "semester"?: string,
  "description"?: string,
  "grading"?: string,
  "topics": Array<{
    "id": string,
    "include": boolean,
    "week"?: string,
    "title": string,
    "description"?: string,
    "confidence": number,
    "warnings": string[]
  }>,
  "readings": Array<{
    "id": string,
    "include": boolean,
    "citation": string,
    "confidence": number
  }>,
  "assessments": Array<{
    "id": string,
    "include": boolean,
    "type": "assignment" | "exam" | "presentation" | "project" | "other",
    "title": string,
    "dueDate"?: "YYYY-MM-DD",
    "weight"?: string,
    "description"?: string,
    "confidence": number,
    "warnings": string[]
  }>,
  "confidence": {
    "title": number,
    "number": number,
    "instructor": number,
    "credits": number,
    "semester": number,
    "description": number,
    "grading": number
  },
  "warnings": string[]
}`;

const INSTRUCTION = `You parse a single university course syllabus used in Israel.
Return only strict JSON matching the supplied schema.
Prompt version: ${PROMPT_VERSION}.

Hard rules:
- Use only facts present in SOURCE TEXT or the deterministic draft.
- Never invent a course title, code, lecturer, credits, dates, grading weights, readings, topics, assignments, or exams.
- Preserve Hebrew course titles, lecturer names, academic terms, and reading citations exactly.
- Do not translate source titles.
- A date may be returned only when the source gives an unambiguous full calendar date. Normalize it to YYYY-MM-DD.
- If a value is absent or ambiguous, leave it empty and add a warning.
- Every extracted field and list item gets a confidence score from 0 to 1.
- Weekly topics must describe actual syllabus topics, not headings such as "weekly schedule" or "course content".
- Readings must be actual source citations or links, not generic labels.
- Assessments include assignments, exams, presentations, and projects only when explicitly mentioned.
- Keep the full grading explanation in grading even when individual weights are also attached to assessments.
- parserType must be ai_assisted and version must be ${COURSE_SYLLABUS_DRAFT_VERSION}.`;

export const Route = createFileRoute("/api/ai/parse-course-syllabus")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isGeminiConfigured()) {
          return Response.json({ ok: false, error: "Lovable AI is not configured" });
        }

        let body: Body;
        try {
          body = (await request.json()) as Body;
        } catch {
          return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
        }

        const rawText = body.rawText?.trim() ?? "";
        if (!rawText) {
          return Response.json({ ok: false, error: "Syllabus text is empty" }, { status: 400 });
        }
        if (!body.deterministicDraft) {
          return Response.json(
            { ok: false, error: "Deterministic draft is required" },
            { status: 400 },
          );
        }

        const clippedText = rawText.slice(0, MAX_TEXT_CHARS);
        const truncationWarning = rawText.length > MAX_TEXT_CHARS ? ["source_text_truncated"] : [];
        const prompt = `${INSTRUCTION}\n\nLocale: ${body.locale ?? "ru"}\nFile name: ${body.fileName ?? ""}\n\nDETERMINISTIC DRAFT:\n${JSON.stringify(body.deterministicDraft)}\n\nSOURCE TEXT:\n${clippedText}`;
        const response = await generateGeminiJSON<unknown>(prompt, SCHEMA);
        if (!response.ok) {
          return Response.json({
            ok: false,
            error: response.error,
            details: response.details,
            model: getGeminiModelName(),
            promptVersion: PROMPT_VERSION,
          });
        }

        const draft = normalizeCourseSyllabusDraft(response.data, body.deterministicDraft);
        draft.parserType = "ai_assisted";
        draft.version = COURSE_SYLLABUS_DRAFT_VERSION;
        draft.sourceFileName = body.fileName?.trim() || draft.sourceFileName;
        draft.warnings = Array.from(new Set([...draft.warnings, ...truncationWarning]));

        return Response.json({
          ok: true,
          draft,
          model: getGeminiModelName(),
          promptVersion: PROMPT_VERSION,
          warnings: draft.warnings,
        });
      },
    },
  },
});
