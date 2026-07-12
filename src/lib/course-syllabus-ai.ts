import type { CourseSyllabusDraft } from "./course-syllabus";

export interface CourseSyllabusAIResult {
  ok: boolean;
  draft?: CourseSyllabusDraft;
  error?: string;
  details?: string;
  model?: string;
  promptVersion?: string;
  warnings?: string[];
}

export async function parseCourseSyllabusWithAI(input: {
  fileName: string;
  rawText: string;
  locale: "ru" | "en";
  deterministicDraft: CourseSyllabusDraft;
}): Promise<CourseSyllabusAIResult> {
  try {
    const response = await fetch("/api/ai/parse-course-syllabus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const payload = (await response.json()) as CourseSyllabusAIResult;
    if (!response.ok || !payload.ok || !payload.draft) {
      return {
        ok: false,
        error: payload.error || `Course syllabus parser failed (${response.status})`,
        details: payload.details,
        model: payload.model,
        promptVersion: payload.promptVersion,
        warnings: payload.warnings,
      };
    }
    return payload;
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
