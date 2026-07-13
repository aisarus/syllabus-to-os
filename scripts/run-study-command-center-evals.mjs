import assert from "node:assert/strict";
import {
  buildStudyCommandCenter,
  buildStudyPlan,
} from "../src/lib/study-command-center.ts";

const now = new Date(2026, 6, 13, 12, 0, 0, 0).getTime();

function emptyData() {
  return {
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
  };
}

{
  const data = emptyData();
  data.courses.push({
    id: "course-1",
    title: "Information Retrieval",
    status: "in_progress",
    order: 0,
    createdAt: now,
  });
  data.assignments.push({
    id: "assignment-overdue",
    title: "Research exercise",
    courseId: "course-1",
    dueDate: "2026-07-11",
    status: "in_progress",
    priority: "high",
    createdAt: now,
  });
  data.flashcards.push(
    ...Array.from({ length: 12 }, (_, index) => ({
      id: `card-${index}`,
      front: `Front ${index}`,
      back: `Back ${index}`,
      courseId: "course-1",
      status: "learning",
      dueAt: now - 60_000,
      interval: 1,
      createdAt: now,
    })),
  );

  const command = buildStudyCommandCenter(data, { now, locale: "en" });
  assert.equal(command.focus.kind, "assignment");
  assert.equal(command.focus.urgency, "critical");
  assert.equal(command.metrics.dueCards, 12);
  assert.equal(command.metrics.openAssignments, 1);
  assert.ok(command.risks.some((risk) => risk.id.startsWith("assignment-risk:")));
}

{
  const data = emptyData();
  data.courses.push({
    id: "course-1",
    title: "Israeli Government",
    status: "in_progress",
    order: 0,
    createdAt: now,
  });
  data.calendarEvents.push({
    id: "exam-1",
    title: "Final exam",
    type: "exam",
    courseId: "course-1",
    date: "2026-07-16",
    createdAt: now,
  });

  const command = buildStudyCommandCenter(data, { now, locale: "en" });
  assert.equal(command.focus.kind, "prepare_exam");
  assert.ok(command.risks.some((risk) => risk.id === "exam-risk:exam-1"));
}

{
  const data = emptyData();
  data.materials.push({
    id: "material-1",
    title: "Lecture 4",
    type: "lecture",
    sourceMode: "uploaded_file",
    tags: [],
    rawText: "Approved lecture text",
    processingStatus: "ready",
    createdAt: now,
    updatedAt: now,
  });

  const command = buildStudyCommandCenter(data, { now, locale: "en" });
  assert.equal(command.focus.kind, "build_study_pack");
  assert.equal(command.focus.materialId, "material-1");
}

{
  const command = buildStudyCommandCenter(emptyData(), { now, locale: "en" });
  assert.equal(command.focus.kind, "intake");
  const plan = buildStudyPlan(command.actions, 20);
  assert.ok(plan.length >= 1);
  assert.ok(plan.reduce((total, item) => total + item.allocatedMinutes, 0) <= 20);
}

{
  const actions = [
    {
      id: "long",
      kind: "prepare_exam",
      title: "Long task",
      detail: "",
      durationMinutes: 45,
      priority: 100,
      urgency: "high",
    },
    {
      id: "short",
      kind: "review_cards",
      title: "Short task",
      detail: "",
      durationMinutes: 10,
      priority: 80,
      urgency: "normal",
    },
  ];
  const plan = buildStudyPlan(actions, 20);
  assert.equal(plan[0].action.id, "long");
  assert.equal(plan[0].allocatedMinutes, 20);
}

console.log("Study command center evaluations passed (5 scenarios).");
