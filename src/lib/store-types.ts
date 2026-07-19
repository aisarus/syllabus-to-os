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
