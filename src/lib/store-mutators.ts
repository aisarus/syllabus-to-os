import type {
  AppData,
  Assignment,
  CalendarEvent,
  CardStatus,
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
  Slide,
  StudySession,
  SyllabusImport,
  Topic,
} from "./store-types.ts";
import { createEmptyAppData, uid } from "./store-runtime.ts";
import {
  deleteMaterialChunkFromWorkspace,
  deleteMaterialFromWorkspace,
  replaceMaterialChunksInWorkspace,
} from "./source-reference-safety.ts";
import { workspaceRepository } from "./workspace-repository.ts";

export type CardReviewQuality = "again" | "good" | "easy";
export type CardReviewListener = (cardId: string, quality: CardReviewQuality) => void;

const cardReviewListeners = new Set<CardReviewListener>();

export function subscribeCardReviewEvents(listener: CardReviewListener): () => void {
  cardReviewListeners.add(listener);
  return () => cardReviewListeners.delete(listener);
}

function notifyCardReview(cardId: string, quality: CardReviewQuality): void {
  cardReviewListeners.forEach((listener) => listener(cardId, quality));
}

export const store = {
  // program
  createProgram(p: Omit<Program, "id" | "createdAt">) {
    const prog: Program = { ...p, id: uid("prog"), createdAt: Date.now() };
    workspaceRepository.update((d) => ({ ...d, programs: [...d.programs, prog] }));
    return prog;
  },
  updateProgram(id: string, patch: Partial<Program>) {
    workspaceRepository.update((d) => ({
      ...d,
      programs: d.programs.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  },
  deleteProgram(id: string) {
    workspaceRepository.update((d) => ({
      ...d,
      programs: d.programs.filter((p) => p.id !== id),
      courses: d.courses.map((c) => (c.programId === id ? { ...c, programId: undefined } : c)),
    }));
  },
  // course
  createCourse(c: Omit<Course, "id" | "createdAt" | "order"> & { order?: number }) {
    const course: Course = {
      ...c,
      order: c.order ?? workspaceRepository.getMutationBase().courses.length,
      id: uid("crs"),
      createdAt: Date.now(),
    };
    workspaceRepository.update((d) => ({ ...d, courses: [...d.courses, course] }));
    return course;
  },
  updateCourse(id: string, patch: Partial<Course>) {
    workspaceRepository.update((d) => ({
      ...d,
      courses: d.courses.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  },
  deleteCourse(id: string) {
    workspaceRepository.update((d) => ({
      ...d,
      courses: d.courses.filter((c) => c.id !== id),
      topics: d.topics.filter((t) => t.courseId !== id),
    }));
  },
  // topic
  createTopic(t: Omit<Topic, "id" | "createdAt" | "order"> & { order?: number }) {
    const topic: Topic = {
      ...t,
      order:
        t.order ??
        workspaceRepository.getMutationBase().topics.filter((x) => x.courseId === t.courseId)
          .length,
      id: uid("top"),
      createdAt: Date.now(),
    };
    workspaceRepository.update((d) => ({ ...d, topics: [...d.topics, topic] }));
    return topic;
  },
  updateTopic(id: string, patch: Partial<Topic>) {
    workspaceRepository.update((d) => ({
      ...d,
      topics: d.topics.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
  },
  deleteTopic(id: string) {
    workspaceRepository.update((d) => ({ ...d, topics: d.topics.filter((t) => t.id !== id) }));
  },
  // note
  createNote(n: Omit<Note, "id" | "createdAt" | "updatedAt">) {
    const now = Date.now();
    const note: Note = { ...n, id: uid("note"), createdAt: now, updatedAt: now };
    workspaceRepository.update((d) => ({ ...d, notes: [note, ...d.notes] }));
    return note;
  },
  updateNote(id: string, patch: Partial<Note>) {
    workspaceRepository.update((d) => ({
      ...d,
      notes: d.notes.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n)),
    }));
  },
  deleteNote(id: string) {
    workspaceRepository.update((d) => ({ ...d, notes: d.notes.filter((n) => n.id !== id) }));
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
    workspaceRepository.update((d) => ({ ...d, flashcards: [...d.flashcards, card] }));
    return card;
  },
  updateCard(id: string, patch: Partial<Flashcard>) {
    workspaceRepository.update((d) => ({
      ...d,
      flashcards: d.flashcards.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  },
  deleteCard(id: string) {
    workspaceRepository.update((d) => ({
      ...d,
      flashcards: d.flashcards.filter((c) => c.id !== id),
    }));
  },
  reviewCard(id: string, quality: CardReviewQuality) {
    workspaceRepository.update((d) => ({
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
    notifyCardReview(id, quality);
  },
  // quiz
  createQuiz(q: Omit<Quiz, "id" | "createdAt">) {
    const quiz: Quiz = { ...q, id: uid("quiz"), createdAt: Date.now() };
    workspaceRepository.update((d) => ({ ...d, quizzes: [...d.quizzes, quiz] }));
    return quiz;
  },
  updateQuiz(id: string, patch: Partial<Quiz>) {
    workspaceRepository.update((d) => ({
      ...d,
      quizzes: d.quizzes.map((q) => (q.id === id ? { ...q, ...patch } : q)),
    }));
  },
  deleteQuiz(id: string) {
    workspaceRepository.update((d) => ({
      ...d,
      quizzes: d.quizzes.filter((q) => q.id !== id),
      quizQuestions: d.quizQuestions.filter((q) => q.quizId !== id),
      quizAttempts: d.quizAttempts.filter((a) => a.quizId !== id),
    }));
  },
  addQuestion(q: Omit<QuizQuestion, "id">) {
    const question: QuizQuestion = { ...q, id: uid("qq") };
    workspaceRepository.update((d) => ({ ...d, quizQuestions: [...d.quizQuestions, question] }));
    return question;
  },
  updateQuestion(id: string, patch: Partial<QuizQuestion>) {
    workspaceRepository.update((d) => ({
      ...d,
      quizQuestions: d.quizQuestions.map((q) => (q.id === id ? { ...q, ...patch } : q)),
    }));
  },
  deleteQuestion(id: string) {
    workspaceRepository.update((d) => ({
      ...d,
      quizQuestions: d.quizQuestions.filter((q) => q.id !== id),
    }));
  },
  recordAttempt(a: Omit<QuizAttempt, "id" | "takenAt">) {
    const attempt: QuizAttempt = { ...a, id: uid("att"), takenAt: Date.now() };
    workspaceRepository.update((d) => ({ ...d, quizAttempts: [attempt, ...d.quizAttempts] }));
    return attempt;
  },
  // assignments
  createAssignment(a: Omit<Assignment, "id" | "createdAt">) {
    const ass: Assignment = { ...a, id: uid("ass"), createdAt: Date.now() };
    workspaceRepository.update((d) => ({ ...d, assignments: [...d.assignments, ass] }));
    return ass;
  },
  updateAssignment(id: string, patch: Partial<Assignment>) {
    workspaceRepository.update((d) => ({
      ...d,
      assignments: d.assignments.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));
  },
  deleteAssignment(id: string) {
    workspaceRepository.update((d) => ({
      ...d,
      assignments: d.assignments.filter((a) => a.id !== id),
    }));
  },
  // materials
  createMaterial(m: Omit<Material, "id" | "createdAt" | "updatedAt">) {
    const now = Date.now();
    const mat: Material = { ...m, id: uid("mat"), createdAt: now, updatedAt: now };
    workspaceRepository.update((d) => ({ ...d, materials: [mat, ...d.materials] }));
    return mat;
  },
  updateMaterial(id: string, patch: Partial<Material>) {
    workspaceRepository.update((d) => ({
      ...d,
      materials: d.materials.map((m) =>
        m.id === id ? { ...m, ...patch, updatedAt: Date.now() } : m,
      ),
    }));
  },
  deleteMaterial(id: string) {
    workspaceRepository.update((data) => deleteMaterialFromWorkspace(data, id));
  },
  recordOutput(o: Omit<MaterialOutput, "id" | "createdAt">) {
    const out: MaterialOutput = { ...o, id: uid("out"), createdAt: Date.now() };
    workspaceRepository.update((d) => ({ ...d, materialOutputs: [out, ...d.materialOutputs] }));
    return out;
  },
  // material chunks
  createMaterialChunk(c: Omit<MaterialChunk, "id" | "createdAt">) {
    const chunk: MaterialChunk = { ...c, id: uid("chk"), createdAt: Date.now() };
    workspaceRepository.update((d) => ({ ...d, materialChunks: [...d.materialChunks, chunk] }));
    return chunk;
  },
  updateMaterialChunk(id: string, patch: Partial<MaterialChunk>) {
    workspaceRepository.update((d) => ({
      ...d,
      materialChunks: d.materialChunks.map((ch) => (ch.id === id ? { ...ch, ...patch } : ch)),
    }));
  },
  deleteMaterialChunk(id: string) {
    workspaceRepository.update((data) => deleteMaterialChunkFromWorkspace(data, id));
  },
  replaceMaterialChunksForMaterial(
    materialId: string,
    chunks: Array<Omit<MaterialChunk, "id" | "createdAt" | "materialId">>,
  ) {
    return workspaceRepository.transaction((data) => {
      const replacement = replaceMaterialChunksInWorkspace(data, materialId, chunks, () =>
        uid("chk"),
      );
      return { data: replacement.data, value: replacement.chunks };
    });
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
    workspaceRepository.update((d) => ({
      ...d,
      presentationOutlines: [outline, ...d.presentationOutlines],
    }));
    return outline;
  },
  updateOutline(id: string, patch: Partial<PresentationOutline>) {
    workspaceRepository.update((d) => ({
      ...d,
      presentationOutlines: d.presentationOutlines.map((p) =>
        p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p,
      ),
    }));
  },
  deleteOutline(id: string) {
    workspaceRepository.update((d) => ({
      ...d,
      presentationOutlines: d.presentationOutlines.filter((p) => p.id !== id),
    }));
  },
  addSlide(outlineId: string, patch?: Partial<Omit<Slide, "id" | "order">>) {
    const slideId = uid("sl");
    workspaceRepository.update((d) => ({
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
    workspaceRepository.update((d) => ({
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
    workspaceRepository.update((d) => ({
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
    workspaceRepository.update((d) => ({ ...d, calendarEvents: [...d.calendarEvents, ev] }));
    return ev;
  },
  updateEvent(id: string, patch: Partial<CalendarEvent>) {
    workspaceRepository.update((d) => ({
      ...d,
      calendarEvents: d.calendarEvents.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));
  },
  deleteEvent(id: string) {
    workspaceRepository.update((d) => ({
      ...d,
      calendarEvents: d.calendarEvents.filter((e) => e.id !== id),
    }));
  },
  // study sessions
  logSession(s: Omit<StudySession, "id" | "completedAt">) {
    const ss: StudySession = { ...s, id: uid("ses"), completedAt: Date.now() };
    workspaceRepository.update((d) => ({ ...d, studySessions: [ss, ...d.studySessions] }));
    return ss;
  },
  deleteSession(id: string) {
    workspaceRepository.update((d) => ({
      ...d,
      studySessions: d.studySessions.filter((s) => s.id !== id),
    }));
  },
  // syllabus imports
  recordSyllabusImport(s: Omit<SyllabusImport, "id" | "createdAt">) {
    const rec: SyllabusImport = { ...s, id: uid("simp"), createdAt: Date.now() };
    workspaceRepository.update((d) => ({ ...d, syllabusImports: [rec, ...d.syllabusImports] }));
    return rec;
  },
  deleteSyllabusImport(id: string) {
    workspaceRepository.update((d) => ({
      ...d,
      syllabusImports: d.syllabusImports.filter((s) => s.id !== id),
    }));
  },
  // bulk
  reset() {
    workspaceRepository.replace(createEmptyAppData());
  },
  replaceAll(next: AppData) {
    workspaceRepository.replace({ ...createEmptyAppData(), ...next, version: 1 });
  },
};
