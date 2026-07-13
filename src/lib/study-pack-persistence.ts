import type { StudyPackDraft } from "./ai";
import { buildStudyPackNoteContent, collectStudyPackSourceIds } from "./study-pack";
import {
  type Flashcard,
  type MaterialOutput,
  type Note,
  type Quiz,
  type QuizQuestion,
  uid,
  updateData,
} from "./store";

export interface PersistStudyPackInput {
  draft: StudyPackDraft;
  locale: "ru" | "en";
  materialId: string;
  materialTitle: string;
  courseId?: string;
  topicId?: string;
  fallbackSourceChunkIds: string[];
}

export interface PersistStudyPackResult {
  noteId: string;
  flashcardIds: string[];
  quizId?: string;
  questionIds: string[];
}

export function persistStudyPack(input: PersistStudyPackInput): PersistStudyPackResult {
  const now = Date.now();
  const context = {
    courseId: input.courseId,
    topicId: input.topicId,
    materialId: input.materialId,
  };
  const packSourceIds = collectStudyPackSourceIds(input.draft);
  const allSourceIds = packSourceIds.length
    ? packSourceIds
    : input.fallbackSourceChunkIds;

  const note: Note = {
    id: uid("note"),
    title: input.draft.title || `${input.materialTitle} — Study Pack`,
    content: buildStudyPackNoteContent(input.draft, input.locale),
    tags: ["study-pack"],
    ...context,
    sourceChunkIds: allSourceIds,
    createdAt: now,
    updatedAt: now,
  };

  const flashcards: Flashcard[] = input.draft.cards.map((card) => ({
    id: uid("card"),
    front: card.front,
    back: card.back,
    ...context,
    sourceChunkIds: card.sourceChunkIds.length
      ? card.sourceChunkIds
      : input.fallbackSourceChunkIds,
    status: "new",
    dueAt: now,
    interval: 0,
    createdAt: now,
  }));

  const quiz: Quiz | undefined = input.draft.questions.length
    ? {
        id: uid("quiz"),
        title: `${input.draft.title || input.materialTitle} — ${
          input.locale === "ru" ? "диагностика" : "diagnostic"
        }`,
        ...context,
        createdAt: now,
      }
    : undefined;

  const questions: QuizQuestion[] = quiz
    ? input.draft.questions.map((question) => ({
        id: uid("qq"),
        quizId: quiz.id,
        prompt: question.prompt,
        options: question.options,
        correctIndex: question.correctIndex,
        explanation: question.explanation,
        sourceChunkIds: question.sourceChunkIds.length
          ? question.sourceChunkIds
          : input.fallbackSourceChunkIds,
      }))
    : [];

  const outputs: MaterialOutput[] = [
    {
      id: uid("out"),
      materialId: input.materialId,
      type: "note",
      linkedEntityId: note.id,
      createdAt: now,
    },
    ...(flashcards.length
      ? [
          {
            id: uid("out"),
            materialId: input.materialId,
            type: "flashcards" as const,
            createdAt: now,
          },
        ]
      : []),
    ...(quiz
      ? [
          {
            id: uid("out"),
            materialId: input.materialId,
            type: "quiz" as const,
            linkedEntityId: quiz.id,
            createdAt: now,
          },
        ]
      : []),
  ];

  updateData((data) => ({
    ...data,
    notes: [note, ...data.notes],
    flashcards: [...data.flashcards, ...flashcards],
    quizzes: quiz ? [...data.quizzes, quiz] : data.quizzes,
    quizQuestions: [...data.quizQuestions, ...questions],
    materialOutputs: [...outputs, ...data.materialOutputs],
  }));

  return {
    noteId: note.id,
    flashcardIds: flashcards.map((card) => card.id),
    quizId: quiz?.id,
    questionIds: questions.map((question) => question.id),
  };
}
