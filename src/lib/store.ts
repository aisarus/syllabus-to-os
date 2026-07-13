import { useSyncExternalStore } from "react";

// ============ Types ============

export type CourseStatus = "not_started" | "in_progress" | "completed";
export type TopicStatus = "not_started" | "learning" | "understood";
export type AssignmentStatus = "not_started" | "in_progress" | "submitted" | "graded";
export type Priority = "low" | "medium" | "high";
export type CardStatus = "new" | "learning" | "mastered";
export type Difficulty = "easy" | "medium" | "hard";

export type MaterialType =
  "syllabus" | "lecture" | "article" | "assignment" | "presentation" | "exam" | "other";
export type MaterialSourceMode = "uploaded_file" | "pasted_text" | "manual";
export type MaterialProcessingStatus = "ready" | "unsupported" | "error" | "no_text" | "partial";
export type MaterialExtractionMethod =
  | "manual"
  | "txt"
  | "markdown"
  | "csv"
  | "json"
  | "html"
  | "xml"
  | "yaml"
  | "xlsx"
  | "docx"
  | "pdf";
export type MaterialSourceLanguage = "ru" | "en" | "he" | "ar" | "mixed" | "unknown";
export type MaterialOutputType =
  "note" | "quiz" | "flashcards" | "outline" | "presentation_outline" | "task_list";

export type CalendarEventType =
  "class" | "assignment" | "exam" | "study_session" | "personal" | "other";
export type Recurrence = "none" | "weekly";

export interface Program {
  id: string;
  name: string;
  institution: string;
  degree: string;
  years: number;
  semesters: string[];
  createdAt: number;
}

export interface Course {
  id: string;
  programId?: string;
  title: string;
  originalTitle?: string;
  number?: string;
  semester?: string;
  credits?: number;
  type?: string;
  instructor?: string;
  prerequisites?: string;
  description?: string;
  status: CourseStatus;
  difficulty?: Difficulty;
  order: number;
  createdAt: number;
}

export interface Topic {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  status: TopicStatus;
  order: number;
  createdAt: number;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  courseId?: string;
  topicId?: string;
  materialId?: string;
  sourceChunkIds?: string[];
  updatedAt: number;
  createdAt: number;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  courseId?: string;
  topicId?: string;
  materialId?: string;
  sourceChunkIds?: string[];
  status: CardStatus;
  dueAt: number;
  interval: number;
  createdAt: number;
}

export interface QuizQuestion {
  id: string;
  quizId: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
  sourceChunkIds?: string[];
}

export interface Quiz {
  id: string;
  title: string;
  courseId?: string;
  topicId?: string;
  materialId?: string;
  createdAt: number;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  score: number;
  correctCount: number;
  total: number;
  takenAt: number;
}

export interface Assignment {
  id: string;
  title: string;
  courseId?: string;
  dueDate?: string;
  status: AssignmentStatus;
  priority: Priority;
  notes?: string;
  grade?: string;
  createdAt: number;
}

export interface Material {
  id: string;
  title: string;
  type: MaterialType;
  sourceMode: MaterialSourceMode;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  courseId?: string;
  topicId?: string;
  tags: string[];
  rawText: string;
  userSummary?: string;
  processingStatus: MaterialProcessingStatus;
  processingMessage?: string;
  pageCount?: number;
  wordCount?: number;
  charCount?: number;
  extractionMethod?: MaterialExtractionMethod;
  sourceLanguage?: MaterialSourceLanguage;
  createdAt: number;
  updatedAt: number;
}

export interface MaterialChunk {
  id: string;
  materialId: string;
  order: number;
  title?: string;
  text: string;
  pageNumber?: number;
  section?: string;
  createdAt: number;
}

export interface MaterialOutput {
  id: string;
  materialId: string;
  type: MaterialOutputType;
  linkedEntityId?: string;
  createdAt: number;
}

export interface Slide {
  id: string;
  title: string;
  bullets: string[];
  speakerNotes?: string;
  sourceQuote?: string;
  sourceChunkIds?: string[];
  order: number;
}

export interface PresentationOutline {
  id: string;
  title: string;
  courseId?: string;
  topicId?: string;
  materialId?: string;
  slides: Slide[];
  createdAt: number;
  updatedAt: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  type: CalendarEventType;
  courseId?: string;
  assignmentId?: string;
  quizId?: string;
  date: string; // yyyy-mm-dd
  startTime?: string; // HH:MM
  endTime?: string;
  recurrence?: Recurrence;
  weekday?: number; // 0-6
  notes?: string;
  createdAt: number;
}

export interface StudySession {
  id: string;
  title: string;
  type: string;
  linkedEntityType?: string;
  linkedEntityId?: string;
  durationMinutes: number;
  completedAt: number;
}

export type SyllabusImportSource = "xlsx" | "json";

export interface SyllabusImport {
  id: string;
  source: SyllabusImportSource;
  fileName?: string;
  sheetName?: string;
  programId?: string;
  programName?: string;
  courseIds: string[];
  topicIds: string[];
  createdAt: number;
}

export interface AppData {
  version: 1;
  programs: Program[];
  courses: Course[];
  topics: Topic[];
  notes: Note[];
  flashcards: Flashcard[];
  quizzes: Quiz[];
  quizQuestions: QuizQuestion[];
  quizAttempts: QuizAttempt[];
  assignments: Assignment[];
  materials: Material[];
  materialChunks: MaterialChunk[];
  materialOutputs: MaterialOutput[];
  presentationOutlines: PresentationOutline[];
  calendarEvents: CalendarEvent[];
  studySessions: StudySession[];
  syllabusImports: SyllabusImport[];
}

const KEY = "lamdan.data.v1";

const empty = (): AppData => ({
  version: 1,
  programs: [],
  courses: [],
  topics: [],
  notes: [],
  flashcards: [],
  quizzes: [],
  quizQuestions: [],
  quizAttempts: [],
  assignments: [],
  materials: [],
  materialChunks: [],
  materialOutputs: [],
  presentationOutlines: [],
  calendarEvents: [],
  studySessions: [],
  syllabusImports: [],
});

function load(): AppData {
  if (typeof window === "undefined") return empty();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw);
    return { ...empty(), ...parsed };
  } catch {
    return empty();
  }
}

const SERVER_SNAPSHOT: AppData = empty();
let state: AppData = SERVER_SNAPSHOT;
let hydrated = false;
const listeners = new Set<() => void>();

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  state = load();
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // A full localStorage quota must not prevent in-memory UI updates.
  }
  listeners.forEach((l) => l());
}

function subscribe(fn: () => void) {
  ensureHydrated();
  queueMicrotask(fn);
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function getSnapshot() {
  return state;
}
function getServerSnapshot() {
  return SERVER_SNAPSHOT;
}

export function useData(): AppData {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setData(next: AppData) {
  state = next;
  persist();
}

export function updateData(fn: (d: AppData) => AppData) {
  state = fn(state);
  persist();
}

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

// ============ Mutators ============

export const store = {
  // program
  createProgram(p: Omit<Program, "id" | "createdAt">) {
    const prog: Program = { ...p, id: uid("prog"), createdAt: Date.now() };
    updateData((d) => ({ ...d, programs: [...d.programs, prog] }));
    return prog;
  },
  updateProgram(id: string, patch: Partial<Program>) {
    updateData((d) => ({
      ...d,
      programs: d.programs.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  },
  deleteProgram(id: string) {
    updateData((d) => ({
      ...d,
      programs: d.programs.filter((p) => p.id !== id),
      courses: d.courses.map((c) => (c.programId === id ? { ...c, programId: undefined } : c)),
    }));
  },
  // course
  createCourse(c: Omit<Course, "id" | "createdAt" | "order"> & { order?: number }) {
    const course: Course = {
      ...c,
      order: c.order ?? state.courses.length,
      id: uid("crs"),
      createdAt: Date.now(),
    };
    updateData((d) => ({ ...d, courses: [...d.courses, course] }));
    return course;
  },
  updateCourse(id: string, patch: Partial<Course>) {
    updateData((d) => ({
      ...d,
      courses: d.courses.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  },
  deleteCourse(id: string) {
    updateData((d) => ({
      ...d,
      courses: d.courses.filter((c) => c.id !== id),
      topics: d.topics.filter((t) => t.courseId !== id),
    }));
  },
  // topic
  createTopic(t: Omit<Topic, "id" | "createdAt" | "order"> & { order?: number }) {
    const topic: Topic = {
      ...t,
      order: t.order ?? state.topics.filter((x) => x.courseId === t.courseId).length,
      id: uid("top"),
      createdAt: Date.now(),
    };
    updateData((d) => ({ ...d, topics: [...d.topics, topic] }));
    return topic;
  },
  updateTopic(id: string, patch: Partial<Topic>) {
    updateData((d) => ({
      ...d,
      topics: d.topics.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
  },
  deleteTopic(id: string) {
    updateData((d) => ({ ...d, topics: d.topics.filter((t) => t.id !== id) }));
  },
  // note
  createNote(n: Omit<Note, "id" | "createdAt" | "updatedAt">) {
    const now = Date.now();
    const note: Note = { ...n, id: uid("note"), createdAt: now, updatedAt: now };
    updateData((d) => ({ ...d, notes: [note, ...d.notes] }));
    return note;
  },
  updateNote(id: string, patch: Partial<Note>) {
    updateData((d) => ({
      ...d,
      notes: d.notes.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n)),
    }));
  },
  deleteNote(id: string) {
    updateData((d) => ({ ...d, notes: d.notes.filter((n) => n.id !== id) }));
  },
  // flashcards
  createCard(c: Omit<Flashcard, "id" | "createdAt" | "status" | "dueAt" | "interval">) {
    const card: Flashcard = {
      ...c,
      id: uid("card"),
      createdAt: Date.now(),
      status: "new",
      dueAt: Date.now(),
      interval: 0,
    };
    updateData((d) => ({ ...d, flashcards: [...d.flashcards, card] }));
    return card;
  },
  updateCard(id: string, patch: Partial<Flashcard>) {
    updateData((d) => ({
      ...d,
      flashcards: d.flashcards.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  },
  deleteCard(id: string) {
    updateData((d) => ({ ...d, flashcards: d.flashcards.filter((c) => c.id !== id) }));
  },
  reviewCard(id: string, quality: "again" | "good" | "easy") {
    updateData((d) => ({
      ...d,
      flashcards: d.flashcards.map((c) => {
        if (c.id !== id) return c;
        let interval = c.interval;
        let status: CardStatus = c.status;
        if (quality === "again") {
          interval = 0;
          status = "learning";
        } else if (quality === "good") {
          interval = Math.max(1, Math.round(interval * 2 || 1));
          status = interval >= 21 ? "mastered" : "learning";
        } else {
          interval = Math.max(3, Math.round(interval * 3 || 3));
          status = interval >= 14 ? "mastered" : "learning";
        }
        return {
          ...c,
          interval,
          status,
          dueAt: Date.now() + interval * 24 * 60 * 60 * 1000,
        };
      }),
    }));
  },
  // quiz
  createQuiz(q: Omit<Quiz, "id" | "createdAt">) {
    const quiz: Quiz = { ...q, id: uid("quiz"), createdAt: Date.now() };
    updateData((d) => ({ ...d, quizzes: [...d.quizzes, quiz] }));
    return quiz;
  },
  updateQuiz(id: string, patch: Partial<Quiz>) {
    updateData((d) => ({
      ...d,
      quizzes: d.quizzes.map((q) => (q.id === id ? { ...q, ...patch } : q)),
    }));
  },
  deleteQuiz(id: string) {
    updateData((d) => ({
      ...d,
      quizzes: d.quizzes.filter((q) => q.id !== id),
      quizQuestions: d.quizQuestions.filter((q) => q.quizId !== id),
      quizAttempts: d.quizAttempts.filter((a) => a.quizId !== id),
    }));
  },
  addQuestion(q: Omit<QuizQuestion, "id">) {
    const question: QuizQuestion = { ...q, id: uid("qq") };
    updateData((d) => ({ ...d, quizQuestions: [...d.quizQuestions, question] }));
    return question;
  },
  updateQuestion(id: string, patch: Partial<QuizQuestion>) {
    updateData((d) => ({
      ...d,
      quizQuestions: d.quizQuestions.map((q) => (q.id === id ? { ...q, ...patch } : q)),
    }));
  },
  deleteQuestion(id: string) {
    updateData((d) => ({
      ...d,
      quizQuestions: d.quizQuestions.filter((q) => q.id !== id),
    }));
  },
  recordAttempt(a: Omit<QuizAttempt, "id" | "takenAt">) {
    const attempt: QuizAttempt = { ...a, id: uid("att"), takenAt: Date.now() };
    updateData((d) => ({ ...d, quizAttempts: [attempt, ...d.quizAttempts] }));
    return attempt;
  },
  // assignments
  createAssignment(a: Omit<Assignment, "id" | "createdAt">) {
    const ass: Assignment = { ...a, id: uid("ass"), createdAt: Date.now() };
    updateData((d) => ({ ...d, assignments: [...d.assignments, ass] }));
    return ass;
  },
  updateAssignment(id: string, patch: Partial<Assignment>) {
    updateData((d) => ({
      ...d,
      assignments: d.assignments.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));
  },
  deleteAssignment(id: string) {
    updateData((d) => ({ ...d, assignments: d.assignments.filter((a) => a.id !== id) }));
  },
  // materials
  createMaterial(m: Omit<Material, "id" | "createdAt" | "updatedAt">) {
    const now = Date.now();
    const mat: Material = { ...m, id: uid("mat"), createdAt: now, updatedAt: now };
    updateData((d) => ({ ...d, materials: [mat, ...d.materials] }));
    return mat;
  },
  updateMaterial(id: string, patch: Partial<Material>) {
    updateData((d) => ({
      ...d,
      materials: d.materials.map((m) =>
        m.id === id ? { ...m, ...patch, updatedAt: Date.now() } : m,
      ),
    }));
  },
  deleteMaterial(id: string) {
    updateData((d) => ({
      ...d,
      materials: d.materials.filter((m) => m.id !== id),
      materialChunks: d.materialChunks.filter((ch) => ch.materialId !== id),
      materialOutputs: d.materialOutputs.filter((o) => o.materialId !== id),
      notes: d.notes.map((n) => (n.materialId === id ? { ...n, materialId: undefined } : n)),
      flashcards: d.flashcards.map((c) =>
        c.materialId === id ? { ...c, materialId: undefined } : c,
      ),
      quizzes: d.quizzes.map((q) => (q.materialId === id ? { ...q, materialId: undefined } : q)),
      presentationOutlines: d.presentationOutlines.map((p) =>
        p.materialId === id ? { ...p, materialId: undefined } : p,
      ),
    }));
  },
  recordOutput(o: Omit<MaterialOutput, "id" | "createdAt">) {
    const out: MaterialOutput = { ...o, id: uid("out"), createdAt: Date.now() };
    updateData((d) => ({ ...d, materialOutputs: [out, ...d.materialOutputs] }));
    return out;
  },
  // material chunks
  createMaterialChunk(c: Omit<MaterialChunk, "id" | "createdAt">) {
    const chunk: MaterialChunk = { ...c, id: uid("chk"), createdAt: Date.now() };
    updateData((d) => ({ ...d, materialChunks: [...d.materialChunks, chunk] }));
    return chunk;
  },
  updateMaterialChunk(id: string, patch: Partial<MaterialChunk>) {
    updateData((d) => ({
      ...d,
      materialChunks: d.materialChunks.map((ch) => (ch.id === id ? { ...ch, ...patch } : ch)),
    }));
  },
  deleteMaterialChunk(id: string) {
    updateData((d) => ({
      ...d,
      materialChunks: d.materialChunks.filter((ch) => ch.id !== id),
      notes: d.notes.map((n) =>
        n.sourceChunkIds?.includes(id)
          ? { ...n, sourceChunkIds: n.sourceChunkIds.filter((x) => x !== id) }
          : n,
      ),
      flashcards: d.flashcards.map((c) =>
        c.sourceChunkIds?.includes(id)
          ? { ...c, sourceChunkIds: c.sourceChunkIds.filter((x) => x !== id) }
          : c,
      ),
      quizQuestions: d.quizQuestions.map((q) =>
        q.sourceChunkIds?.includes(id)
          ? { ...q, sourceChunkIds: q.sourceChunkIds.filter((x) => x !== id) }
          : q,
      ),
    }));
  },
  replaceMaterialChunksForMaterial(
    materialId: string,
    chunks: Array<Omit<MaterialChunk, "id" | "createdAt" | "materialId">>,
  ) {
    const now = Date.now();
    const created: MaterialChunk[] = chunks.map((c, i) => ({
      ...c,
      order: c.order ?? i,
      materialId,
      id: uid("chk"),
      createdAt: now,
    }));
    updateData((d) => ({
      ...d,
      materialChunks: [
        ...d.materialChunks.filter((ch) => ch.materialId !== materialId),
        ...created,
      ],
    }));
    return created;
  },
  // presentation outlines
  createOutline(
    o: Omit<PresentationOutline, "id" | "createdAt" | "updatedAt" | "slides"> & {
      slides?: Slide[];
    },
  ) {
    const now = Date.now();
    const outline: PresentationOutline = {
      ...o,
      id: uid("pres"),
      slides: o.slides ?? [],
      createdAt: now,
      updatedAt: now,
    };
    updateData((d) => ({ ...d, presentationOutlines: [outline, ...d.presentationOutlines] }));
    return outline;
  },
  updateOutline(id: string, patch: Partial<PresentationOutline>) {
    updateData((d) => ({
      ...d,
      presentationOutlines: d.presentationOutlines.map((p) =>
        p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p,
      ),
    }));
  },
  deleteOutline(id: string) {
    updateData((d) => ({
      ...d,
      presentationOutlines: d.presentationOutlines.filter((p) => p.id !== id),
    }));
  },
  addSlide(outlineId: string, patch?: Partial<Omit<Slide, "id" | "order">>) {
    const slideId = uid("sl");
    updateData((d) => ({
      ...d,
      presentationOutlines: d.presentationOutlines.map((p) => {
        if (p.id !== outlineId) return p;
        const slide: Slide = {
          id: slideId,
          title: patch?.title ?? "New slide",
          bullets: patch?.bullets ?? [],
          speakerNotes: patch?.speakerNotes,
          sourceQuote: patch?.sourceQuote,
          sourceChunkIds: patch?.sourceChunkIds,
          order: p.slides.length,
        };
        return { ...p, slides: [...p.slides, slide], updatedAt: Date.now() };
      }),
    }));
    return slideId;
  },
  updateSlide(outlineId: string, slideId: string, patch: Partial<Slide>) {
    updateData((d) => ({
      ...d,
      presentationOutlines: d.presentationOutlines.map((p) => {
        if (p.id !== outlineId) return p;
        return {
          ...p,
          slides: p.slides.map((s) => (s.id === slideId ? { ...s, ...patch } : s)),
          updatedAt: Date.now(),
        };
      }),
    }));
  },
  deleteSlide(outlineId: string, slideId: string) {
    updateData((d) => ({
      ...d,
      presentationOutlines: d.presentationOutlines.map((p) => {
        if (p.id !== outlineId) return p;
        return {
          ...p,
          slides: p.slides.filter((s) => s.id !== slideId),
          updatedAt: Date.now(),
        };
      }),
    }));
  },
  // calendar
  createEvent(e: Omit<CalendarEvent, "id" | "createdAt">) {
    const ev: CalendarEvent = { ...e, id: uid("ev"), createdAt: Date.now() };
    updateData((d) => ({ ...d, calendarEvents: [...d.calendarEvents, ev] }));
    return ev;
  },
  updateEvent(id: string, patch: Partial<CalendarEvent>) {
    updateData((d) => ({
      ...d,
      calendarEvents: d.calendarEvents.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));
  },
  deleteEvent(id: string) {
    updateData((d) => ({
      ...d,
      calendarEvents: d.calendarEvents.filter((e) => e.id !== id),
    }));
  },
  // study sessions
  logSession(s: Omit<StudySession, "id" | "completedAt">) {
    const ss: StudySession = { ...s, id: uid("ses"), completedAt: Date.now() };
    updateData((d) => ({ ...d, studySessions: [ss, ...d.studySessions] }));
    return ss;
  },
  deleteSession(id: string) {
    updateData((d) => ({
      ...d,
      studySessions: d.studySessions.filter((s) => s.id !== id),
    }));
  },
  // syllabus imports
  recordSyllabusImport(s: Omit<SyllabusImport, "id" | "createdAt">) {
    const rec: SyllabusImport = { ...s, id: uid("simp"), createdAt: Date.now() };
    updateData((d) => ({ ...d, syllabusImports: [rec, ...d.syllabusImports] }));
    return rec;
  },
  deleteSyllabusImport(id: string) {
    updateData((d) => ({
      ...d,
      syllabusImports: d.syllabusImports.filter((s) => s.id !== id),
    }));
  },
  // bulk
  reset() {
    setData(empty());
  },
  replaceAll(next: AppData) {
    setData({ ...empty(), ...next, version: 1 });
  },
};

export function exportJSON(): string {
  return JSON.stringify(state, null, 2);
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
  ensureHydrated();
  return JSON.parse(JSON.stringify(state)) as AppData;
}

/**
 * Writes the text workspace before notifying React. Unlike the ordinary store
 * mutators, this lets a full backup import detect a storage-quota failure and
 * roll its IndexedDB transaction back.
 */
export function replaceAllAtomically(next: AppData): void {
  const normalized = normalizeAppData(next as unknown as Record<string, unknown>);
  const serialized = JSON.stringify(normalized);
  if (typeof window !== "undefined") {
    localStorage.setItem(KEY, serialized);
  }
  state = normalized;
  listeners.forEach((listener) => listener());
}

export function importJSON(json: string): { ok: true } | { ok: false; error: string } {
  const parsed = parseAppDataJSON(json);
  if (!parsed.ok) return parsed;
  setData(parsed.data);
  return { ok: true };
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
