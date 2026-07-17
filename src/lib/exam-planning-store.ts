import { useSyncExternalStore } from "react";
import {
  buildExamStudyPlan,
  todayKey,
  validateExamPlanningProfile,
  type ExamPlanningProfile,
  type ExamStudyDay,
  type ExamStudyPlan,
  type ExamStudyTask,
} from "./exam-planning";
import { uid, type AppData } from "./store";

export interface ExamPlanningData {
  version: 1;
  profiles: ExamPlanningProfile[];
  plans: ExamStudyPlan[];
}

const KEY = "lamdan.exam-planning.v1";
const EMPTY: ExamPlanningData = { version: 1, profiles: [], plans: [] };
let state = EMPTY;
let hydrated = false;
const listeners = new Set<() => void>();

function ensureHydrated(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(KEY);
    state = raw ? normalizeData(JSON.parse(raw)) : EMPTY;
  } catch {
    state = EMPTY;
  }
}

function persist(next: ExamPlanningData): void {
  const normalized = normalizeData(next);
  if (typeof window !== "undefined") {
    const serialized = JSON.stringify(normalized);
    localStorage.setItem(KEY, serialized);
    if (localStorage.getItem(KEY) !== serialized) {
      throw new Error("Exam planning data could not be verified after saving.");
    }
  }
  state = normalized;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  ensureHydrated();
  queueMicrotask(listener);
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useExamPlanningData(): ExamPlanningData {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => EMPTY,
  );
}

export function getExamPlanningSnapshot(): ExamPlanningData {
  ensureHydrated();
  return JSON.parse(JSON.stringify(state)) as ExamPlanningData;
}

export const examPlanningStore = {
  saveAndGenerate(input: {
    profileId?: string;
    courseId: string;
    examDate: string;
    dailyMinutes: number;
    sessionMinutes: number;
    availableWeekdays: number[];
    topicWeights: Record<string, number>;
    core: AppData;
    now?: number;
  }): { profile: ExamPlanningProfile; plan: ExamStudyPlan } {
    ensureHydrated();
    const now = input.now ?? Date.now();
    const validation = validateExamPlanningProfile(input, input.core, todayKey(now));
    if (!validation.ok) throw new Error(validation.errors.join(" "));
    const previous = state.profiles.find((profile) => profile.id === input.profileId);
    const profile: ExamPlanningProfile = {
      id: previous?.id ?? uid("exam_profile"),
      courseId: input.courseId,
      examDate: input.examDate,
      dailyMinutes: input.dailyMinutes,
      sessionMinutes: input.sessionMinutes,
      availableWeekdays: [...new Set(input.availableWeekdays)].sort(),
      topicWeights: Object.fromEntries(
        validation.topics.map((topic) => [
          topic.id,
          Math.min(5, Math.max(1, Math.round(input.topicWeights[topic.id] ?? 1))),
        ]),
      ),
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    };
    const plan = buildExamStudyPlan({
      id: uid("exam_plan"),
      profile,
      core: input.core,
      generatedAt: now,
      today: todayKey(now),
    });
    persist({
      version: 1,
      profiles: [profile, ...state.profiles.filter((item) => item.id !== profile.id)],
      plans: [plan, ...state.plans.filter((item) => item.profileId !== profile.id)].slice(0, 20),
    });
    return { profile, plan };
  },

  deleteProfile(profileId: string): void {
    ensureHydrated();
    persist({
      version: 1,
      profiles: state.profiles.filter((profile) => profile.id !== profileId),
      plans: state.plans.filter((plan) => plan.profileId !== profileId),
    });
  },
};

function normalizeData(raw: unknown): ExamPlanningData {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return EMPTY;
  const value = raw as Record<string, unknown>;
  const profiles = Array.isArray(value.profiles)
    ? value.profiles
        .map(normalizeProfile)
        .filter((item): item is ExamPlanningProfile => Boolean(item))
    : [];
  const profileIds = new Set(profiles.map((profile) => profile.id));
  const plans = Array.isArray(value.plans)
    ? value.plans
        .map(normalizePlan)
        .filter(
          (item): item is ExamStudyPlan => Boolean(item && profileIds.has(item.profileId)),
        )
    : [];
  return { version: 1, profiles, plans };
}

function normalizeProfile(raw: unknown): ExamPlanningProfile | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const id = text(value.id);
  const courseId = text(value.courseId);
  const examDate = text(value.examDate);
  if (!id || !courseId || !/^\d{4}-\d{2}-\d{2}$/u.test(examDate)) return null;
  return {
    id,
    courseId,
    examDate,
    dailyMinutes: clamp(value.dailyMinutes, 10, 480, 60),
    sessionMinutes: clamp(value.sessionMinutes, 5, 120, 25),
    availableWeekdays: numberArray(value.availableWeekdays).filter((day) => day >= 0 && day <= 6),
    topicWeights: numberRecord(value.topicWeights, 1, 5),
    createdAt: finite(value.createdAt, Date.now()),
    updatedAt: finite(value.updatedAt, Date.now()),
  };
}

function normalizePlan(raw: unknown): ExamStudyPlan | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const id = text(value.id);
  const profileId = text(value.profileId);
  const courseId = text(value.courseId);
  if (!id || !profileId || !courseId) return null;
  const days = Array.isArray(value.days)
    ? value.days
        .map((day) => {
          if (!day || typeof day !== "object" || Array.isArray(day)) return null;
          const item = day as Record<string, unknown>;
          const date = text(item.date);
          const tasks = Array.isArray(item.tasks)
            ? item.tasks
                .map((task) => {
                  if (!task || typeof task !== "object" || Array.isArray(task)) return null;
                  const entry = task as Record<string, unknown>;
                  const taskId = text(entry.id);
                  const topicId = text(entry.topicId);
                  const topicTitle = text(entry.topicTitle);
                  if (!taskId || !topicId || !topicTitle) return null;
                  return {
                    id: taskId,
                    topicId,
                    topicTitle,
                    minutes: clamp(entry.minutes, 1, 480, 1),
                  };
                })
                .filter((task): task is ExamStudyTask => Boolean(task))
            : [];
          return {
            date,
            totalMinutes: tasks.reduce((sum, task) => sum + task.minutes, 0),
            tasks,
          };
        })
        .filter((day): day is ExamStudyDay => Boolean(day))
    : [];
  return {
    id,
    profileId,
    courseId,
    generatedAt: finite(value.generatedAt, Date.now()),
    startDate: text(value.startDate),
    examDate: text(value.examDate),
    totalMinutes: days.reduce((sum, day) => sum + day.totalMinutes, 0),
    topicTotals: numberRecord(value.topicTotals, 0, Number.MAX_SAFE_INTEGER),
    days,
    warnings: stringArray(value.warnings),
  };
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function finite(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value: unknown, minimum: number, maximum: number, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(maximum, Math.max(minimum, Math.round(number)))
    : fallback;
}

function numberArray(value: unknown): number[] {
  return Array.isArray(value)
    ? [...new Set(value.map(Number).filter(Number.isInteger))].sort()
    : [];
}

function numberRecord(
  value: unknown,
  minimum: number,
  maximum: number,
): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      clamp(item, minimum, maximum, minimum),
    ]),
  );
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.map(text).filter(Boolean))] : [];
}
