import assert from "node:assert/strict";
import {
  GLOBAL_SEARCH_VERSION,
  findSearchRanges,
  normalizeSearchText,
  parseGlobalSearchQuery,
  searchWorkspace,
} from "../src/lib/global-search.ts";

const now = 1_720_000_000_000;
const data = {
  version: 1,
  programs: [],
  courses: [
    {
      id: "course_info",
      title: "מבוא למידע",
      originalTitle: "Introduction to Information Studies",
      number: "615",
      status: "not_started",
      order: 0,
      createdAt: now,
    },
    {
      id: "course_arch",
      title: "ארכאולוגיה של ירושלים",
      originalTitle: "Archaeology of Jerusalem",
      status: "not_started",
      order: 1,
      createdAt: now,
    },
  ],
  topics: [],
  notes: [
    {
      id: "note_exact",
      title: "Information retrieval",
      content: "A concise note about precision and recall.",
      tags: ["retrieval"],
      courseId: "course_info",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "note_hebrew",
      title: "מְבוֹא לְמֵידָע",
      content: "מושגי יסוד בארגון מידע ובחיפוש.",
      tags: [],
      courseId: "course_info",
      createdAt: now + 1,
      updatedAt: now + 1,
    },
  ],
  flashcards: [
    {
      id: "card_precision",
      front: "What is precision?",
      back: "Relevant retrieved items divided by all retrieved items.",
      courseId: "course_info",
      sourceChunkIds: [],
      status: "new",
      dueAt: now,
      interval: 0,
      createdAt: now,
    },
  ],
  quizzes: [
    {
      id: "quiz_arch",
      title: "Jerusalem archaeology review",
      courseId: "course_arch",
      materialId: "material_arch",
      createdAt: now,
    },
  ],
  quizQuestions: [
    {
      id: "question_arch",
      quizId: "quiz_arch",
      prompt: "Which period preceded the First Temple period?",
      options: ["Iron Age", "Bronze Age", "Roman period", "Ottoman period"],
      correctIndex: 1,
      explanation: "The source places the Bronze Age before the Iron Age.",
      sourceChunkIds: ["chunk_arch"],
    },
  ],
  quizAttempts: [],
  assignments: [],
  materials: [
    {
      id: "material_info",
      title: "Lecture 1 — Search systems",
      type: "lecture",
      sourceMode: "uploaded_file",
      courseId: "course_info",
      tags: ["retrieval", "index"],
      rawText:
        "Information retrieval studies search systems. The phrase exact title appears only in the body.",
      processingStatus: "ready",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "material_arch",
      title: "Jerusalem field notes",
      type: "lecture",
      sourceMode: "uploaded_file",
      courseId: "course_arch",
      tags: ["archaeology"],
      rawText: "The Bronze Age preceded the Iron Age in this simplified source fixture.",
      processingStatus: "ready",
      createdAt: now,
      updatedAt: now,
    },
  ],
  materialChunks: [
    {
      id: "chunk_info",
      materialId: "material_info",
      order: 0,
      title: "Precision and recall",
      text: "Precision measures relevant retrieved results. Recall measures recovered relevant results.",
      pageNumber: 7,
      section: "Evaluation metrics",
      createdAt: now,
    },
    {
      id: "chunk_arch",
      materialId: "material_arch",
      order: 0,
      title: "Chronology",
      text: "The Bronze Age preceded the Iron Age.",
      pageNumber: 3,
      section: "Periods",
      createdAt: now,
    },
  ],
  materialOutputs: [],
  presentationOutlines: [],
  calendarEvents: [],
  studySessions: [],
  syllabusImports: [],
};

assert.equal(GLOBAL_SEARCH_VERSION, "local-search-v2");
assert.equal(normalizeSearchText("מְבוֹא לְמֵידָע"), "מבוא למידע");
assert.deepEqual(parseGlobalSearchQuery('"information retrieval" precision').terms, [
  "information retrieval",
  "precision",
]);

const hebrew = searchWorkspace(data, "מבוא מידע");
assert.equal(hebrew[0]?.id, "note_hebrew", "Hebrew niqqud-insensitive title should rank first.");
assert.ok(hebrew[0]?.titleRanges.length, "Hebrew title match should expose highlight ranges.");

const ranked = searchWorkspace(data, "information retrieval");
assert.equal(ranked[0]?.id, "note_exact", "Exact note title should outrank a body-only mention.");
assert.ok(ranked.some((hit) => hit.id === "material_info"), "Body matches should remain searchable.");

const requiredTerms = searchWorkspace(data, "precision bronze");
assert.equal(requiredTerms.length, 0, "All unquoted query terms must be present in one result.");

const quoted = searchWorkspace(data, '"precision and recall"');
assert.equal(quoted[0]?.id, "chunk_info", "Quoted phrase should preserve word order.");
assert.equal(quoted[0]?.pageNumber, 7, "Chunk search should preserve source page metadata.");
assert.equal(quoted[0]?.materialId, "material_info");

const courseFiltered = searchWorkspace(data, "age", { courseId: "course_info" });
assert.equal(courseFiltered.length, 0, "Course filtering must exclude another course's results.");
const archaeology = searchWorkspace(data, "bronze age", { courseId: "course_arch" });
assert.ok(archaeology.length >= 2, "Course filtering should retain matching source and quiz content.");
assert.ok(archaeology.every((hit) => hit.courseId === "course_arch"));

const card = searchWorkspace(data, "retrieved items", { kinds: ["flashcard"] });
assert.equal(card[0]?.id, "card_precision", "The back of a flashcard must be searchable.");
assert.equal(card[0]?.matchedField, "back");

const ranges = findSearchRanges("מְבוֹא לְמֵידָע", ["מבוא"]);
assert.ok(ranges.length > 0);
assert.equal("מְבוֹא לְמֵידָע".slice(ranges[0].start, ranges[0].end).replace(/[\u0591-\u05c7]/gu, ""), "מבוא");

const firstRun = searchWorkspace(data, "retrieval").map((hit) => `${hit.kind}:${hit.id}`);
const secondRun = searchWorkspace(data, "retrieval").map((hit) => `${hit.kind}:${hit.id}`);
assert.deepEqual(firstRun, secondRun, "Ranking must be deterministic.");

console.log(
  "Global search v2 passed Hebrew normalization, exact-title ranking, phrase, AND, course, card-back, page metadata, highlighting and deterministic-order evaluations.",
);
