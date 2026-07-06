import { useSyncExternalStore } from "react";

// ============ Types ============

export type CourseStatus = "not_started" | "in_progress" | "completed";
export type TopicStatus = "not_started" | "learning" | "understood";
export type AssignmentStatus = "not_started" | "in_progress" | "submitted" | "graded";
export type Priority = "low" | "medium" | "high";
export type CardStatus = "new" | "learning" | "mastered";
export type Difficulty = "easy" | "medium" | "hard";

export type MaterialType =
  | "syllabus"
  | "lecture"
  | "article"
  | "assignment"
  | "presentation"
  | "exam"
  | "other";
export type MaterialSourceMode = "uploaded_file" | "pasted_text" | "manual";
export type MaterialProcessingStatus = "ready" | "unsupported" | "error" | "no_text";
export type MaterialOutputType =
  | "note"
  | "quiz"
  | "flashcards"
  | "outline"
  | "presentation_outline"
  | "task_list";

export type CalendarEventType =
  | "class"
  | "assignment"
  | "exam"
  | "study_session"
  | "personal"
  | "other";
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
  createdAt: number;
  updatedAt: number;
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
  materialOutputs: MaterialOutput[];
  presentationOutlines: PresentationOutline[];
  calendarEvents: CalendarEvent[];
  studySessions: StudySession[];
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
  materialOutputs: [],
  presentationOutlines: [],
  calendarEvents: [],
  studySessions: [],
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
  } catch {}
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
  // presentation outlines
  createOutline(o: Omit<PresentationOutline, "id" | "createdAt" | "updatedAt" | "slides"> & { slides?: Slide[] }) {
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
  addSlide(outlineId: string) {
    updateData((d) => ({
      ...d,
      presentationOutlines: d.presentationOutlines.map((p) => {
        if (p.id !== outlineId) return p;
        const slide: Slide = {
          id: uid("sl"),
          title: "New slide",
          bullets: [],
          order: p.slides.length,
        };
        return { ...p, slides: [...p.slides, slide], updatedAt: Date.now() };
      }),
    }));
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

export function importJSON(json: string): { ok: true } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object") return { ok: false, error: "Not an object" };
    const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
    const shape: AppData = {
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
      materialOutputs: arr<MaterialOutput>(parsed.materialOutputs),
      presentationOutlines: arr<PresentationOutline>(parsed.presentationOutlines),
      calendarEvents: arr<CalendarEvent>(parsed.calendarEvents),
      studySessions: arr<StudySession>(parsed.studySessions),
    };
    setData(shape);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
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
  const mk = (n: string, title: string, orig: string, sem: string, credits: number, order: number): Course => ({
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
