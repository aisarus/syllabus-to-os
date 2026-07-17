import assert from "node:assert/strict";
import { buildExamStudyPlan, validateExamPlanningProfile } from "../src/lib/exam-planning.ts";

const core = {
  version: 1,
  programs: [],
  courses: [
    {
      id: "course-1",
      title: "Political Science",
      status: "in_progress",
      order: 0,
      createdAt: 1,
    },
  ],
  topics: [
    { id: "topic-a", courseId: "course-1", title: "Institutions", status: "learning", order: 0, createdAt: 1 },
    { id: "topic-b", courseId: "course-1", title: "Elections", status: "learning", order: 1, createdAt: 1 },
  ],
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

const profile = {
  id: "profile-1",
  courseId: "course-1",
  examDate: "2026-08-01",
  dailyMinutes: 60,
  sessionMinutes: 25,
  availableWeekdays: [0, 1, 2, 3, 4, 5, 6],
  topicWeights: { "topic-a": 4, "topic-b": 1 },
  createdAt: 1,
  updatedAt: 1,
};

const validation = validateExamPlanningProfile(profile, core, "2026-07-18");
assert.equal(validation.ok, true);
assert.equal(validation.availableDates.length, 14);

const plan = buildExamStudyPlan({
  id: "plan-1",
  profile,
  core,
  generatedAt: Date.UTC(2026, 6, 18),
  today: "2026-07-18",
});
assert.equal(plan.days.length, 14);
assert.equal(plan.totalMinutes, 840);
assert(plan.days.every((day) => day.totalMinutes <= 60));
assert(plan.days.every((day) => day.tasks.every((task) => task.minutes <= 25)));
assert(plan.topicTotals["topic-a"] > plan.topicTotals["topic-b"] * 3);
assert.deepEqual(
  plan,
  buildExamStudyPlan({
    id: "plan-1",
    profile,
    core,
    generatedAt: Date.UTC(2026, 6, 18),
    today: "2026-07-18",
  }),
);

const bounded = validateExamPlanningProfile(
  { ...profile, examDate: "2027-12-01" },
  core,
  "2026-07-18",
);
assert.equal(bounded.ok, true);
assert.equal(bounded.availableDates.length, 180);
assert(bounded.warnings.some((warning) => warning.includes("180")));

const weekdays = validateExamPlanningProfile(
  { ...profile, availableWeekdays: [1], examDate: "2026-07-21" },
  core,
  "2026-07-18",
);
assert.equal(weekdays.availableDates.length, 1);
assert.equal(new Date(`${weekdays.availableDates[0]}T00:00:00Z`).getUTCDay(), 1);

const invalid = validateExamPlanningProfile(
  { ...profile, examDate: "2026-07-18", dailyMinutes: 999, availableWeekdays: [] },
  core,
  "2026-07-18",
);
assert.equal(invalid.ok, false);
assert(invalid.errors.some((error) => error.includes("future")));
assert(invalid.errors.some((error) => error.includes("Daily budget")));
assert(invalid.errors.some((error) => error.includes("weekday")));

console.log("Bounded exam planning evaluations passed.");
