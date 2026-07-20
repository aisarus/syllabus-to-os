import { createFileRoute } from "@tanstack/react-router";
import {
  aiErrorResponse,
  parseAIJsonRequest,
  safeAIInternalErrorResponse,
  syllabusParseInputSchema,
} from "@/lib/server/ai-api-contract";
import { generateGeminiJSON, getGeminiModelName, isGeminiConfigured } from "@/lib/server/gemini";

// POST /api/ai/parse-syllabus
// Uses Google Gemini to refine a deterministic syllabus draft.
// GEMINI_API_KEY is read only server-side and never leaves this file.

const SYSTEM_INSTRUCTION = `You are parsing an Israeli academic syllabus or university program table.

Return only strict JSON matching the ParsedSyllabusDraft schema.
Do not wrap JSON in markdown.
Do not include commentary.
Do not invent courses.
Do not invent credits.
Do not invent instructors.
Do not invent semesters.
Skip header rows, section rows, total rows, empty rows, and general notes.
Preserve Hebrew course titles exactly.
Group courses by detected year and semester.
If a value is uncertain, keep it empty and add a warning.
Every course must include source sheet name and source row index when available.
Never translate course titles.
Never import row labels such as מספר קורס, שם קורס, שנה א׳ סמסטר א, סה״כ as courses.
Course numbers must go into the number field, never into the title field.`;

const SCHEMA_DESC = `{
  id: string,
  sourceFileName: string,
  parserVersion: string,
  parserType: "ai_assisted",
  confidence: number (0..1),
  institution?: string,
  programName?: string,
  degree?: string,
  warnings: string[],
  semesters: Array<{ id: string, title: string, year?: string|number, semester?: string, creditsTotal?: number, order: number }>,
  courses: Array<{
    id: string, include: boolean, title: string, originalTitle?: string,
    number?: string, semester?: string, year?: string|number, credits?: number,
    type?: string, instructor?: string, prerequisites?: string, description?: string,
    notes?: string, topics: string[], confidence: number (0..1), warnings: string[],
    source: { sheetName: string, rowIndex: number, originalCells: string[] }
  }>,
  ignoredRows: Array<{
    id: string, sheetName: string, rowIndex: number, detectedType: string,
    reason: string, cells: string[], confidence: number
  }>
}`;

// ---- validation ----

const HEADER_TITLE_BLACKLIST = new Set([
  "מספר קורס",
  "שם קורס",
  'מס"ק',
  "מס' קורס",
  "מס קורס",
  "קוד קורס",
  "course number",
  "course name",
  "course title",
  "title",
  "name",
  "code",
  "no",
  "#",
  'סה"כ',
  "סה״כ",
  "total",
  "subtotal",
]);

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/["׳״'`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

interface Draft {
  id?: unknown;
  sourceFileName?: unknown;
  parserVersion?: unknown;
  parserType?: unknown;
  confidence?: unknown;
  institution?: unknown;
  programName?: unknown;
  degree?: unknown;
  warnings?: unknown;
  semesters?: unknown;
  courses?: unknown;
  ignoredRows?: unknown;
}

function validateAndClean(input: unknown, fileName: string, warnings: string[]): Draft | null {
  if (!input || typeof input !== "object") return null;
  const d = input as Draft & Record<string, unknown>;

  const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
  const str = (v: unknown, dflt = ""): string => (typeof v === "string" ? v : dflt);
  const num = (v: unknown, dflt = 0): number =>
    typeof v === "number" && Number.isFinite(v) ? v : dflt;
  const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

  const semesters = arr(d.semesters).map((s: unknown, i) => {
    const so = (s as Record<string, unknown>) ?? {};
    return {
      id: str(so.id) || `sem_ai_${i}`,
      title: str(so.title),
      year: so.year,
      semester: str(so.semester),
      creditsTotal: num(so.creditsTotal, 0),
      order: num(so.order, i),
    };
  });

  const courses = arr(d.courses)
    .map((c: unknown, i) => {
      const co = (c as Record<string, unknown>) ?? {};
      const rawTitle = str(co.title).trim();
      const rawNumber = str(co.number).trim();
      const src = (co.source as Record<string, unknown>) ?? {};
      return {
        id: str(co.id) || `crs_ai_${i}`,
        include: co.include !== false,
        title: rawTitle,
        originalTitle: str(co.originalTitle) || undefined,
        number: rawNumber || undefined,
        semester: str(co.semester) || undefined,
        year: co.year,
        credits: typeof co.credits === "number" ? co.credits : undefined,
        type: str(co.type) || undefined,
        instructor: str(co.instructor) || undefined,
        prerequisites: str(co.prerequisites) || undefined,
        description: str(co.description) || undefined,
        notes: str(co.notes) || undefined,
        topics: arr(co.topics)
          .map((t) => String(t))
          .filter(Boolean),
        confidence: clamp01(num(co.confidence, 0.5)),
        warnings: arr(co.warnings).map((w) => String(w)),
        source: {
          sheetName: str(src.sheetName),
          rowIndex: num(src.rowIndex, 0),
          originalCells: arr(src.originalCells).map((x) => String(x)),
        },
      };
    })
    // Drop invalid rows
    .filter((c) => {
      if (!c.include) return true; // keep excluded ones so user sees them
      if (!c.title) return false;
      if (/^\d+([-./]\d+)*$/.test(c.title)) return false; // title is only a number
      if (HEADER_TITLE_BLACKLIST.has(norm(c.title))) return false;
      return true;
    });

  const ignoredRows = arr(d.ignoredRows).map((r: unknown, i) => {
    const ro = (r as Record<string, unknown>) ?? {};
    return {
      id: str(ro.id) || `ign_ai_${i}`,
      sheetName: str(ro.sheetName),
      rowIndex: num(ro.rowIndex, 0),
      detectedType: str(ro.detectedType, "unknown_row"),
      reason: str(ro.reason, "unclassified"),
      cells: arr(ro.cells).map((x) => String(x)),
      confidence: clamp01(num(ro.confidence, 0.5)),
    };
  });

  if (courses.length === 0) warnings.push("gemini_returned_no_courses");

  return {
    id: str(d.id) || `syl_ai_${Date.now().toString(36)}`,
    sourceFileName: str(d.sourceFileName) || fileName,
    parserVersion: str(d.parserVersion) || "ai-gemini",
    parserType: "ai_assisted",
    confidence: clamp01(num(d.confidence, 0.6)),
    institution: str(d.institution) || undefined,
    programName: str(d.programName) || undefined,
    degree: str(d.degree) || undefined,
    warnings: arr(d.warnings)
      .map((w) => String(w))
      .concat(warnings),
    semesters,
    courses,
    ignoredRows,
    stats: {
      detectedSemesters: semesters.length,
      detectedCourses: courses.length,
      warnings: arr(d.warnings).length + warnings.length,
      lowConfidenceCourses: courses.filter((c) => c.confidence < 0.6).length,
    },
  } as Draft;
}

export const Route = createFileRoute("/api/ai/parse-syllabus")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = await parseAIJsonRequest(request, syllabusParseInputSchema);
        if (!parsed.ok) return parsed.response;
        const body = parsed.data;

        if (!isGeminiConfigured()) {
          return aiErrorResponse("PROVIDER_UNAVAILABLE", "AI is not configured.", 503);
        }

        try {
          const sheets = (body.sheets ?? []).map((sheet) => ({
            name: sheet.name,
            rows: sheet.rows.slice(0, 400).map((row) => row.slice(0, 20)),
          }));

          const prompt =
            SYSTEM_INSTRUCTION +
            "\n\nRefine the deterministic syllabus draft below. Input follows as JSON:\n\n" +
            JSON.stringify({
              fileName: body.fileName ?? "",
              locale: body.locale ?? "ru",
              deterministicDraft: body.deterministicDraft ?? null,
              ignoredRows: body.ignoredRows ?? [],
              sheets,
            });

          const result = await generateGeminiJSON<unknown>(prompt, SCHEMA_DESC);
          if (!result.ok) {
            return aiErrorResponse("PROVIDER_ERROR", "AI provider request failed.", 502);
          }

          const warnings: string[] = [];
          const draft = validateAndClean(result.data, body.fileName ?? "", warnings);
          if (!draft) {
            return aiErrorResponse(
              "INVALID_PROVIDER_RESPONSE",
              "AI returned an invalid response.",
              502,
            );
          }

          return Response.json({
            ok: true,
            draft,
            warnings,
            model: getGeminiModelName(),
          });
        } catch {
          return safeAIInternalErrorResponse();
        }
      },
    },
  },
});
