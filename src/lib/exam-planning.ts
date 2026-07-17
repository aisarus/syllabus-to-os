import type { AppData, Topic } from "./store";

export const MAX_EXAM_PLAN_DAYS = 180;
export const MAX_DAILY_MINUTES = 480;

export interface ExamPlanningProfile {
  id: string;
  courseId: string;
  examDate: string;
  dailyMinutes: number;
  sessionMinutes: number;
  availableWeekdays: number[];
  topicWeights: Record<string, number>;
  createdAt: number;
  updatedAt: number;
}

export interface ExamStudyTask {
  id: string;
  topicId: string;
  topicTitle: string;
  minutes: number;
}

export interface ExamStudyDay {
  date: string;
  totalMinutes: number;
  tasks: ExamStudyTask[];
}

export interface ExamStudyPlan {
  id: string;
  profileId: string;
  courseId: string;
  generatedAt: number;
  startDate: string;
  examDate: string;
  totalMinutes: number;
  topicTotals: Record<string, number>;
  days: ExamStudyDay[];
  warnings: string[];
}

export interface ExamPlanningValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
  topics: Topic[];
  availableDates: string[];
  planningStartDate?: string;
}

export function validateExamPlanningProfile(
  profile: Pick<
    ExamPlanningProfile,
    | "courseId"
    | "examDate"
    | "dailyMinutes"
    | "sessionMinutes"
    | "availableWeekdays"
    | "topicWeights"
  >,
  core: AppData,
  today: string,
): ExamPlanningValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const topics = core.topics
    .filter((topic) => topic.courseId === profile.courseId)
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  if (!core.courses.some((course) => course.id === profile.courseId)) {
    errors.push("The selected course no longer exists.");
  }
  if (topics.length === 0) errors.push("The selected course has no topics to schedule.");
  const start = parseDate(today);
  const exam = parseDate(profile.examDate);
  if (!start) errors.push("The planning start date is invalid.");
  if (!exam) errors.push("The exam date is invalid.");
  if (start && exam && exam <= start) errors.push("The exam date must be in the future.");
  if (!Number.isInteger(profile.dailyMinutes) || profile.dailyMinutes < 10 || profile.dailyMinutes > 480) {
    errors.push("Daily budget must be between 10 and 480 minutes.");
  }
  if (!Number.isInteger(profile.sessionMinutes) || profile.sessionMinutes < 5 || profile.sessionMinutes > 120) {
    errors.push("Session length must be between 5 and 120 minutes.");
  }
  const weekdays = normalizeWeekdays(profile.availableWeekdays);
  if (weekdays.length === 0) errors.push("Select at least one available weekday.");
  for (const topic of topics) {
    const weight = Number(profile.topicWeights[topic.id] ?? 1);
    if (!Number.isFinite(weight) || weight < 1 || weight > 5) {
      errors.push(`Topic weight for ${topic.title} must be between 1 and 5.`);
    }
  }
  let planningStartDate: string | undefined;
  let availableDates: string[] = [];
  if (start && exam && exam > start) {
    const fullDays = Math.round((exam.getTime() - start.getTime()) / 86_400_000);
    const windowStart = fullDays > MAX_EXAM_PLAN_DAYS ? addDays(exam, -MAX_EXAM_PLAN_DAYS) : start;
    planningStartDate = toDateKey(windowStart);
    if (fullDays > MAX_EXAM_PLAN_DAYS) {
      warnings.push(`The plan is limited to the final ${MAX_EXAM_PLAN_DAYS} days.`);
    }
    availableDates = enumerateDates(windowStart, exam).filter((key) =>
      weekdays.includes(parseDate(key)?.getUTCDay() ?? -1),
    );
    if (availableDates.length === 0) errors.push("No selected weekdays exist before the exam.");
  }
  if (topics.length === 1) warnings.push("Only one topic is available; all time goes there.");
  return {
    ok: errors.length === 0,
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)],
    topics,
    availableDates,
    planningStartDate,
  };
}

export function buildExamStudyPlan(input: {
  id: string;
  profile: ExamPlanningProfile;
  core: AppData;
  generatedAt: number;
  today: string;
}): ExamStudyPlan {
  const validation = validateExamPlanningProfile(input.profile, input.core, input.today);
  if (!validation.ok || !validation.planningStartDate) {
    throw new Error(validation.errors.join(" "));
  }
  const states = validation.topics.map((topic, index) => ({
    topic,
    index,
    weight: clamp(input.profile.topicWeights[topic.id] ?? 1, 1, 5),
    assigned: 0,
  }));
  const totalBudget = validation.availableDates.length * input.profile.dailyMinutes;
  const targets = weightedTargets(totalBudget, states.map((state) => state.weight));
  const days: ExamStudyDay[] = [];
  for (const date of validation.availableDates) {
    let remaining = input.profile.dailyMinutes;
    const tasks: ExamStudyTask[] = [];
    while (remaining > 0) {
      const state = states
        .filter((item) => item.assigned < targets[item.index])
        .sort((a, b) => {
          const aGap = (targets[a.index] - a.assigned) / a.weight;
          const bGap = (targets[b.index] - b.assigned) / b.weight;
          return bGap - aGap || b.weight - a.weight || a.index - b.index;
        })[0];
      if (!state) break;
      const minutes = Math.min(
        remaining,
        input.profile.sessionMinutes,
        targets[state.index] - state.assigned,
      );
      if (minutes <= 0) break;
      state.assigned += minutes;
      remaining -= minutes;
      tasks.push({
        id: `${input.id}:${date}:${tasks.length}`,
        topicId: state.topic.id,
        topicTitle: state.topic.title,
        minutes,
      });
    }
    days.push({
      date,
      totalMinutes: tasks.reduce((sum, task) => sum + task.minutes, 0),
      tasks,
    });
  }
  return {
    id: input.id,
    profileId: input.profile.id,
    courseId: input.profile.courseId,
    generatedAt: input.generatedAt,
    startDate: validation.planningStartDate,
    examDate: input.profile.examDate,
    totalMinutes: days.reduce((sum, day) => sum + day.totalMinutes, 0),
    topicTotals: Object.fromEntries(states.map((state) => [state.topic.id, state.assigned])),
    days,
    warnings: validation.warnings,
  };
}

export function todayKey(timestamp = Date.now()): string {
  const value = new Date(timestamp);
  return toDateKey(new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())));
}

function weightedTargets(total: number, weights: number[]): number[] {
  const sum = weights.reduce((value, weight) => value + weight, 0);
  const raw = weights.map((weight) => (total * weight) / Math.max(1, sum));
  const targets = raw.map(Math.floor);
  let remainder = total - targets.reduce((value, target) => value + target, 0);
  const order = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let index = 0; remainder > 0; index += 1, remainder -= 1) {
    targets[order[index % order.length].index] += 1;
  }
  return targets;
}

function normalizeWeekdays(values: number[]): number[] {
  return [...new Set(values.map(Number).filter((value) => Number.isInteger(value) && value >= 0 && value <= 6))].sort();
}

function enumerateDates(start: Date, end: Date): string[] {
  const values: string[] = [];
  for (let cursor = start; cursor < end; cursor = addDays(cursor, 1)) values.push(toDateKey(cursor));
  return values;
}

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? date
    : null;
}

function toDateKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

function clamp(value: unknown, min: number, max: number): number {
  const number = Number(value);
  return Math.min(max, Math.max(min, Number.isFinite(number) ? Math.round(number) : min));
}
