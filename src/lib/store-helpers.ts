import type {
  AppData,
  Assignment,
  CalendarEvent,
  Course,
  Flashcard,
  Material,
  MaterialChunk,
  MaterialOutput,
  Note,
  PresentationOutline,
  Program,
  Quiz,
  QuizAttempt,
  QuizQuestion,
  StudySession,
  SyllabusImport,
  Topic,
} from "./store-types.ts";
import { readPublishedWorkspaceData, setData, uid, updateData } from "./store-runtime.ts";

export function exportJSON(): string {
  return JSON.stringify(readPublishedWorkspaceData(), null, 2);
}

/**
 * Parses a Lamdan JSON payload without touching the in-browser workspace.
 * Full visual backup validation uses this before it is allowed to mutate either
 * localStorage or IndexedDB.
 */
export function parseAppDataJSON(
  json: string,
): { ok: true; data: AppData } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, error: "Not an object" };
    }
    return { ok: true, data: normalizeAppData(parsed as Record<string, unknown>) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** A copy is required for import rollback so later UI updates cannot mutate it. */
export function getDataSnapshot(): AppData {
  return JSON.parse(JSON.stringify(readPublishedWorkspaceData())) as AppData;
}

/**
 * Writes the text workspace before notifying React. Unlike the ordinary store
 * mutators, this lets a full backup import detect a storage-quota failure and
 * roll its IndexedDB transaction back.
 */
export function replaceAllAtomically(next: AppData): void {
  const normalized = normalizeAppData(next as unknown as Record<string, unknown>);
  setData(normalized);
}

export function importJSON(json: string): { ok: true } | { ok: false; error: string } {
  const parsed = parseAppDataJSON(json);
  if (!parsed.ok) return parsed;
  try {
    setData(parsed.data);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function normalizeAppData(parsed: Record<string, unknown>): AppData {
  const arr = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
  return {
    version: 1,
    programs: arr<Program>(parsed.programs),
    courses: arr<Course>(parsed.courses),
    topics: arr<Topic>(parsed.topics),
    notes: arr<Note>(parsed.notes),
    flashcards: arr<Flashcard>(parsed.flashcards),
    quizzes: arr<Quiz>(parsed.quizzes),
    quizQuestions: arr<QuizQuestion>(parsed.quizQuestions),
    quizAttempts: arr<QuizAttempt>(parsed.quizAttempts),
    assignments: arr<Assignment>(parsed.assignments),
    materials: arr<Material>(parsed.materials),
    materialChunks: arr<MaterialChunk>(parsed.materialChunks),
    materialOutputs: arr<MaterialOutput>(parsed.materialOutputs),
    presentationOutlines: arr<PresentationOutline>(parsed.presentationOutlines),
    calendarEvents: arr<CalendarEvent>(parsed.calendarEvents),
    studySessions: arr<StudySession>(parsed.studySessions),
    syllabusImports: arr<SyllabusImport>(parsed.syllabusImports),
  };
}

// ============ Chunk / search helpers ============

export function getChunksByMaterial(d: AppData, materialId: string): MaterialChunk[] {
  return d.materialChunks
    .filter((c) => c.materialId === materialId)
    .slice()
    .sort((a, b) => a.order - b.order);
}

export type SearchHit =
  | { kind: "course"; id: string; title: string; snippet: string; courseId?: string }
  | { kind: "topic"; id: string; title: string; snippet: string; courseId?: string }
  | { kind: "material"; id: string; title: string; snippet: string; courseId?: string }
  | {
      kind: "chunk";
      id: string;
      title: string;
      snippet: string;
      materialId: string;
      courseId?: string;
    }
  | { kind: "note"; id: string; title: string; snippet: string; courseId?: string }
  | { kind: "flashcard"; id: string; title: string; snippet: string; courseId?: string }
  | { kind: "quiz"; id: string; title: string; snippet: string; courseId?: string }
  | { kind: "question"; id: string; title: string; snippet: string; quizId: string }
  | { kind: "assignment"; id: string; title: string; snippet: string; courseId?: string }
  | { kind: "outline"; id: string; title: string; snippet: string; courseId?: string };

function snip(text: string | undefined, q: string, len = 140): string {
  if (!text) return "";
  const lower = text.toLowerCase();
  const idx = lower.indexOf(q.toLowerCase());
  if (idx < 0) return text.slice(0, len);
  const start = Math.max(0, idx - 40);
  return (start > 0 ? "…" : "") + text.slice(start, start + len);
}

export function searchAll(d: AppData, query: string, limit = 200): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const has = (s?: string) => (s ? s.toLowerCase().includes(q) : false);
  const hits: SearchHit[] = [];

  for (const c of d.courses) {
    if (has(c.title) || has(c.originalTitle) || has(c.description) || has(c.number)) {
      hits.push({
        kind: "course",
        id: c.id,
        title: c.title,
        snippet: snip(c.description, q),
        courseId: c.id,
      });
    }
  }
  for (const tp of d.topics) {
    if (has(tp.title) || has(tp.description)) {
      hits.push({
        kind: "topic",
        id: tp.id,
        title: tp.title,
        snippet: snip(tp.description, q),
        courseId: tp.courseId,
      });
    }
  }
  for (const m of d.materials) {
    if (has(m.title) || has(m.rawText) || m.tags.some((t) => t.toLowerCase().includes(q))) {
      hits.push({
        kind: "material",
        id: m.id,
        title: m.title,
        snippet: snip(m.rawText, q),
        courseId: m.courseId,
      });
    }
  }
  for (const ch of d.materialChunks) {
    if (has(ch.text) || has(ch.title) || has(ch.section)) {
      const mat = d.materials.find((m) => m.id === ch.materialId);
      hits.push({
        kind: "chunk",
        id: ch.id,
        title: ch.title || `${mat?.title ?? ""} · chunk ${ch.order + 1}`,
        snippet: snip(ch.text, q),
        materialId: ch.materialId,
        courseId: mat?.courseId,
      });
    }
  }
  for (const n of d.notes) {
    if (has(n.title) || has(n.content) || n.tags.some((t) => t.toLowerCase().includes(q))) {
      hits.push({
        kind: "note",
        id: n.id,
        title: n.title || "—",
        snippet: snip(n.content, q),
        courseId: n.courseId,
      });
    }
  }
  for (const c of d.flashcards) {
    if (has(c.front) || has(c.back)) {
      hits.push({
        kind: "flashcard",
        id: c.id,
        title: c.front,
        snippet: snip(c.back, q),
        courseId: c.courseId,
      });
    }
  }
  for (const qz of d.quizzes) {
    if (has(qz.title)) {
      hits.push({ kind: "quiz", id: qz.id, title: qz.title, snippet: "", courseId: qz.courseId });
    }
  }
  for (const qq of d.quizQuestions) {
    if (has(qq.prompt) || has(qq.explanation) || qq.options.some((o) => has(o))) {
      hits.push({
        kind: "question",
        id: qq.id,
        title: qq.prompt,
        snippet: snip(qq.explanation, q),
        quizId: qq.quizId,
      });
    }
  }
  for (const a of d.assignments) {
    if (has(a.title) || has(a.notes)) {
      hits.push({
        kind: "assignment",
        id: a.id,
        title: a.title,
        snippet: snip(a.notes, q),
        courseId: a.courseId,
      });
    }
  }
  for (const o of d.presentationOutlines) {
    const slideHit = o.slides.some((s) => has(s.title) || s.bullets.some((b) => has(b)));
    if (has(o.title) || slideHit) {
      hits.push({ kind: "outline", id: o.id, title: o.title, snippet: "", courseId: o.courseId });
    }
  }
  return hits.slice(0, limit);
}

// ============ Sample data ============

export function loadSampleBarIlan() {
  const now = Date.now();
  const program: Program = {
    id: uid("prog"),
    name: "Information Studies · לימודי מידע",
    institution: "Bar-Ilan University",
    degree: "B.A.",
    years: 3,
    semesters: ["Sem A 2025/26", "Sem B 2025/26"],
    createdAt: now,
  };
  const mk = (
    n: string,
    title: string,
    orig: string,
    sem: string,
    credits: number,
    order: number,
  ): Course => ({
    id: uid("crs"),
    programId: program.id,
    title,
    originalTitle: orig,
    number: n,
    semester: sem,
    credits,
    type: "Required",
    status: "not_started",
    difficulty: "medium",
    order,
    createdAt: now,
  });
  const courses: Course[] = [
    mk("615", "Introduction to Programming", "יסודות התכנות", "Sem A 2025/26", 5, 0),
    mk("159", "Computer Architecture & OS", "מבנה המחשב ומערכות הפעלה", "Sem A 2025/26", 4, 1),
    mk("162", "Data Structures", "מבני נתונים", "Sem B 2025/26", 4, 2),
    mk("167", "Introduction to AI", "מבוא לבינה מלאכותית", "Sem B 2025/26", 4, 3),
    mk("166", "Advanced Full Stack", "פיתוח Full Stack מתקדם", "Sem B 2025/26", 3, 4),
  ];
  updateData((d) => ({
    ...d,
    programs: [...d.programs, program],
    courses: [...d.courses, ...courses],
  }));
}
