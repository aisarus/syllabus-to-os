import { useSyncExternalStore } from "react";

// ============ Types ============

export type CourseStatus = "not_started" | "in_progress" | "completed";
export type TopicStatus = "not_started" | "learning" | "understood";
export type AssignmentStatus = "not_started" | "in_progress" | "submitted" | "graded";
export type Priority = "low" | "medium" | "high";
export type CardStatus = "new" | "learning" | "mastered";
export type Difficulty = "easy" | "medium" | "hard";

export interface Program {
  id: string;
  name: string;
  institution: string;
  degree: string;
  years: number;
  semesters: string[]; // e.g. ["Sem 1 2025/26", ...]
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
  updatedAt: number;
  createdAt: number;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  courseId?: string;
  topicId?: string;
  status: CardStatus;
  dueAt: number; // ms epoch
  interval: number; // days
  createdAt: number;
}

export interface QuizQuestion {
  id: string;
  quizId: string;
  prompt: string;
  options: string[];
  correctIndex: number;
}

export interface Quiz {
  id: string;
  title: string;
  courseId?: string;
  topicId?: string;
  createdAt: number;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  score: number; // 0-100
  correctCount: number;
  total: number;
  takenAt: number;
}

export interface Assignment {
  id: string;
  title: string;
  courseId?: string;
  dueDate?: string; // yyyy-mm-dd
  status: AssignmentStatus;
  priority: Priority;
  notes?: string;
  grade?: string;
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

let state: AppData = load();
const listeners = new Set<() => void>();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
  listeners.forEach((l) => l());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function getSnapshot() {
  return state;
}

function getServerSnapshot() {
  return state;
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
    updateData((d) => ({
      ...d,
      assignments: d.assignments.filter((a) => a.id !== id),
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
    // basic shape validation — ensure arrays exist
    const shape: AppData = {
      version: 1,
      programs: Array.isArray(parsed.programs) ? parsed.programs : [],
      courses: Array.isArray(parsed.courses) ? parsed.courses : [],
      topics: Array.isArray(parsed.topics) ? parsed.topics : [],
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
      flashcards: Array.isArray(parsed.flashcards) ? parsed.flashcards : [],
      quizzes: Array.isArray(parsed.quizzes) ? parsed.quizzes : [],
      quizQuestions: Array.isArray(parsed.quizQuestions) ? parsed.quizQuestions : [],
      quizAttempts: Array.isArray(parsed.quizAttempts) ? parsed.quizAttempts : [],
      assignments: Array.isArray(parsed.assignments) ? parsed.assignments : [],
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
