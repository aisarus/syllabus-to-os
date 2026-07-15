import type { AppData } from "./store";

export type StudyCommandLocale = "ru" | "en";

export type StudyActionKind =
  | "assignment"
  | "review_cards"
  | "prepare_exam"
  | "review_material"
  | "practice_quiz"
  | "build_study_pack"
  | "continue_course"
  | "intake";

export type StudyUrgency = "critical" | "high" | "normal" | "low";

export interface StudyAction {
  id: string;
  kind: StudyActionKind;
  title: string;
  detail: string;
  durationMinutes: number;
  priority: number;
  urgency: StudyUrgency;
  courseId?: string;
  materialId?: string;
  quizId?: string;
  assignmentId?: string;
}

export interface StudyRisk {
  id: string;
  title: string;
  detail: string;
  urgency: Exclude<StudyUrgency, "low">;
  courseId?: string;
  materialId?: string;
}

export interface StudyCommandMetrics {
  dueCards: number;
  openAssignments: number;
  materialsNeedingReview: number;
  activeCourses: number;
  studiedMinutesThisWeek: number;
}

export interface StudyCommandCenter {
  focus: StudyAction;
  actions: StudyAction[];
  quickWins: StudyAction[];
  risks: StudyRisk[];
  metrics: StudyCommandMetrics;
}

export interface StudyPlanItem {
  action: StudyAction;
  allocatedMinutes: number;
}

const DAY = 24 * 60 * 60 * 1000;

function translate(locale: StudyCommandLocale, ru: string, en: string) {
  return locale === "ru" ? ru : en;
}

function parseDateEnd(value?: string): number | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day] = match;
  const timestamp = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    23,
    59,
    59,
    999,
  ).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function daysUntil(timestamp: number, now: number) {
  return Math.ceil((timestamp - now) / DAY);
}

function urgencyForDays(days: number): StudyUrgency {
  if (days < 0) return "critical";
  if (days <= 2) return "high";
  if (days <= 7) return "normal";
  return "low";
}

function courseTitle(data: AppData, courseId?: string) {
  if (!courseId) return undefined;
  return data.courses.find((course) => course.id === courseId)?.title;
}

function sortActions(actions: StudyAction[]) {
  return [...actions].sort(
    (left, right) => right.priority - left.priority || left.durationMinutes - right.durationMinutes,
  );
}

export function buildStudyPlan(actions: StudyAction[], budgetMinutes: number): StudyPlanItem[] {
  const safeBudget = Math.max(5, Math.round(budgetMinutes));
  let remaining = safeBudget;
  const result: StudyPlanItem[] = [];

  for (const action of sortActions(actions)) {
    if (remaining < 5) break;
    const allocatedMinutes = Math.min(action.durationMinutes, remaining);
    if (allocatedMinutes < 5) continue;
    result.push({ action, allocatedMinutes });
    remaining -= allocatedMinutes;
  }

  if (result.length === 0 && actions[0]) {
    result.push({ action: actions[0], allocatedMinutes: safeBudget });
  }

  return result;
}

export function buildStudyCommandCenter(
  data: AppData,
  options: { now?: number; locale?: StudyCommandLocale } = {},
): StudyCommandCenter {
  const now = options.now ?? Date.now();
  const locale = options.locale ?? "en";
  const actions: StudyAction[] = [];
  const risks: StudyRisk[] = [];

  const openAssignments = data.assignments.filter(
    (assignment) => assignment.status !== "submitted" && assignment.status !== "graded",
  );

  for (const assignment of openAssignments) {
    const dueAt = parseDateEnd(assignment.dueDate);
    if (dueAt === null) continue;
    const days = daysUntil(dueAt, now);
    if (days > 14) continue;
    const course = courseTitle(data, assignment.courseId);
    const overdue = days < 0;
    const when = overdue
      ? translate(locale, `просрочено на ${Math.abs(days)} дн.`, `${Math.abs(days)}d overdue`)
      : days === 0
        ? translate(locale, "срок сегодня", "due today")
        : translate(locale, `через ${days} дн.`, `due in ${days}d`);

    actions.push({
      id: `assignment:${assignment.id}`,
      kind: "assignment",
      title: overdue
        ? translate(locale, `Разблокировать: ${assignment.title}`, `Unblock: ${assignment.title}`)
        : translate(locale, `Продвинуть: ${assignment.title}`, `Advance: ${assignment.title}`),
      detail: [course, when].filter(Boolean).join(" · "),
      durationMinutes: overdue || days <= 2 ? 25 : 15,
      priority: overdue ? 110 : days <= 2 ? 98 : days <= 7 ? 82 : 65,
      urgency: urgencyForDays(days),
      courseId: assignment.courseId,
      assignmentId: assignment.id,
    });

    if (days <= 2) {
      risks.push({
        id: `assignment-risk:${assignment.id}`,
        title: overdue
          ? translate(locale, "Просроченное задание", "Overdue assignment")
          : translate(locale, "Близкий дедлайн", "Deadline approaching"),
        detail: `${assignment.title} · ${when}`,
        urgency: overdue ? "critical" : "high",
        courseId: assignment.courseId,
      });
    }
  }

  const dueCards = data.flashcards.filter((card) => card.dueAt <= now);
  if (dueCards.length > 0) {
    const durationMinutes = Math.min(35, Math.max(8, Math.ceil(dueCards.length * 0.7)));
    actions.push({
      id: "cards:due",
      kind: "review_cards",
      title: translate(
        locale,
        `Повторить ${dueCards.length} карточек`,
        `Review ${dueCards.length} due cards`,
      ),
      detail: translate(
        locale,
        "Короткое повторение сейчас дешевле повторного изучения перед экзаменом.",
        "A short review now is cheaper than relearning the material before the exam.",
      ),
      durationMinutes,
      priority: dueCards.length >= 20 ? 92 : dueCards.length >= 8 ? 78 : 62,
      urgency: dueCards.length >= 20 ? "high" : "normal",
    });
  }

  const examEvents = data.calendarEvents
    .filter((event) => event.type === "exam")
    .map((event) => ({ event, dueAt: parseDateEnd(event.date) }))
    .filter((item): item is { event: (typeof data.calendarEvents)[number]; dueAt: number } =>
      Boolean(item.dueAt && item.dueAt >= now - DAY),
    )
    .sort((left, right) => left.dueAt - right.dueAt);

  for (const { event, dueAt } of examEvents.slice(0, 3)) {
    const days = Math.max(0, daysUntil(dueAt, now));
    const course = courseTitle(data, event.courseId);
    actions.push({
      id: `exam:${event.id}`,
      kind: "prepare_exam",
      title: translate(locale, `Подготовка: ${event.title}`, `Prepare: ${event.title}`),
      detail: [
        course,
        days === 0
          ? translate(locale, "экзамен сегодня", "exam today")
          : translate(locale, `до экзамена ${days} дн.`, `${days}d until exam`),
      ]
        .filter(Boolean)
        .join(" · "),
      durationMinutes: days <= 2 ? 45 : days <= 7 ? 35 : 25,
      priority: days <= 2 ? 104 : days <= 7 ? 90 : days <= 14 ? 76 : 58,
      urgency: days <= 2 ? "critical" : days <= 7 ? "high" : "normal",
      courseId: event.courseId,
    });

    const courseQuizzes = data.quizzes.filter((quiz) => quiz.courseId === event.courseId);
    const hasAttempt = courseQuizzes.some((quiz) =>
      data.quizAttempts.some((attempt) => attempt.quizId === quiz.id),
    );
    if (days <= 7 && !hasAttempt) {
      risks.push({
        id: `exam-risk:${event.id}`,
        title: translate(locale, "Экзамен без симуляции", "Exam without a simulation"),
        detail: translate(
          locale,
          `${event.title}: до даты ${days} дн., но по курсу ещё нет попытки теста.`,
          `${event.title}: ${days}d remain, but the course has no quiz attempt yet.`,
        ),
        urgency: days <= 2 ? "critical" : "high",
        courseId: event.courseId,
      });
    }
  }

  const reviewMaterials = data.materials
    .filter((material) => material.processingStatus !== "ready")
    .sort((left, right) => right.updatedAt - left.updatedAt);

  for (const material of reviewMaterials.slice(0, 3)) {
    const course = courseTitle(data, material.courseId);
    actions.push({
      id: `material-review:${material.id}`,
      kind: "review_material",
      title: translate(
        locale,
        `Разобрать источник: ${material.title}`,
        `Review source: ${material.title}`,
      ),
      detail: [course, material.processingMessage || material.processingStatus]
        .filter(Boolean)
        .join(" · "),
      durationMinutes: 12,
      priority: material.processingStatus === "error" ? 74 : 68,
      urgency: material.processingStatus === "error" ? "high" : "normal",
      courseId: material.courseId,
      materialId: material.id,
    });
  }

  const latestAttempts = new Map<string, (typeof data.quizAttempts)[number]>();
  for (const attempt of [...data.quizAttempts].sort((a, b) => b.takenAt - a.takenAt)) {
    if (!latestAttempts.has(attempt.quizId)) latestAttempts.set(attempt.quizId, attempt);
  }
  for (const quiz of data.quizzes) {
    const attempt = latestAttempts.get(quiz.id);
    if (!attempt || attempt.score >= 70) continue;
    const course = courseTitle(data, quiz.courseId);
    actions.push({
      id: `quiz:${quiz.id}`,
      kind: "practice_quiz",
      title: translate(locale, `Разобрать ошибки: ${quiz.title}`, `Repair mistakes: ${quiz.title}`),
      detail: [
        course,
        translate(locale, `последний результат ${attempt.score}%`, `last score ${attempt.score}%`),
      ]
        .filter(Boolean)
        .join(" · "),
      durationMinutes: 18,
      priority: attempt.score < 50 ? 80 : 69,
      urgency: attempt.score < 50 ? "high" : "normal",
      courseId: quiz.courseId,
      quizId: quiz.id,
    });
  }

  const recentReadyMaterials = [...data.materials]
    .filter((material) => material.processingStatus === "ready")
    .sort((left, right) => right.updatedAt - left.updatedAt);
  for (const material of recentReadyMaterials.slice(0, 5)) {
    const hasOutput = data.materialOutputs.some((output) => output.materialId === material.id);
    if (hasOutput) continue;
    const course = courseTitle(data, material.courseId);
    actions.push({
      id: `study-pack:${material.id}`,
      kind: "build_study_pack",
      title: translate(
        locale,
        `Превратить в учебный комплект: ${material.title}`,
        `Turn into a study pack: ${material.title}`,
      ),
      detail: [
        course,
        translate(
          locale,
          "нет сохранённых конспектов, карточек или тестов",
          "no saved notes, cards or quizzes",
        ),
      ]
        .filter(Boolean)
        .join(" · "),
      durationMinutes: 20,
      priority: 60,
      urgency: "normal",
      courseId: material.courseId,
      materialId: material.id,
    });
  }

  const coursesWithoutMaterials = data.courses.filter(
    (course) => !data.materials.some((material) => material.courseId === course.id),
  );
  for (const course of coursesWithoutMaterials.slice(0, 2)) {
    risks.push({
      id: `empty-course:${course.id}`,
      title: translate(locale, "Курс без источников", "Course without sources"),
      detail: translate(
        locale,
        `${course.title}: Lamdan пока не может построить учебный маршрут.`,
        `${course.title}: Lamdan cannot build a study route yet.`,
      ),
      urgency: "normal",
      courseId: course.id,
    });
  }

  if (reviewMaterials.length > 2) {
    risks.push({
      id: "review-backlog",
      title: translate(locale, "Очередь необработанных источников", "Source review backlog"),
      detail: translate(
        locale,
        `${reviewMaterials.length} материалов ещё нельзя надёжно использовать для обучения.`,
        `${reviewMaterials.length} materials are not yet reliable study sources.`,
      ),
      urgency: "normal",
    });
  }

  if (dueCards.length >= 25) {
    risks.push({
      id: "card-backlog",
      title: translate(locale, "Накопилось повторение", "Review backlog is growing"),
      detail: translate(
        locale,
        `${dueCards.length} карточек уже ждут повторения.`,
        `${dueCards.length} cards are already due.`,
      ),
      urgency: dueCards.length >= 50 ? "high" : "normal",
    });
  }

  if (actions.length === 0) {
    const latestMaterial = recentReadyMaterials[0];
    const firstCourse = data.courses[0];
    if (latestMaterial) {
      actions.push({
        id: `continue:${latestMaterial.id}`,
        kind: "build_study_pack",
        title: translate(
          locale,
          `Продолжить: ${latestMaterial.title}`,
          `Continue: ${latestMaterial.title}`,
        ),
        detail: translate(
          locale,
          "Источник готов. Создай из него следующий полезный учебный результат.",
          "The source is ready. Turn it into the next useful study output.",
        ),
        durationMinutes: 20,
        priority: 50,
        urgency: "low",
        courseId: latestMaterial.courseId,
        materialId: latestMaterial.id,
      });
    } else if (firstCourse) {
      actions.push({
        id: `course:${firstCourse.id}`,
        kind: "continue_course",
        title: translate(
          locale,
          `Открыть курс: ${firstCourse.title}`,
          `Open course: ${firstCourse.title}`,
        ),
        detail: translate(
          locale,
          "Добавь первый источник или проверь структуру курса.",
          "Add the first source or review the course structure.",
        ),
        durationMinutes: 10,
        priority: 40,
        urgency: "low",
        courseId: firstCourse.id,
      });
    } else {
      actions.push({
        id: "intake:first-source",
        kind: "intake",
        title: translate(locale, "Добавить первый учебный источник", "Add your first study source"),
        detail: translate(
          locale,
          "Загрузи силлабус, PDF, презентацию, текст или фотографию.",
          "Upload a syllabus, PDF, presentation, text or photograph.",
        ),
        durationMinutes: 10,
        priority: 40,
        urgency: "low",
      });
    }
  }

  const sortedActions = sortActions(actions);
  const weekStart = now - 7 * DAY;
  const studiedMinutesThisWeek = data.studySessions
    .filter((session) => session.completedAt >= weekStart)
    .reduce((total, session) => total + Math.max(0, session.durationMinutes), 0);

  return {
    focus: sortedActions[0],
    actions: sortedActions,
    quickWins: sortedActions.filter((action) => action.durationMinutes <= 15).slice(0, 3),
    risks: risks
      .sort((left, right) => {
        const weight = { critical: 3, high: 2, normal: 1 } as const;
        return weight[right.urgency] - weight[left.urgency];
      })
      .slice(0, 4),
    metrics: {
      dueCards: dueCards.length,
      openAssignments: openAssignments.length,
      materialsNeedingReview: reviewMaterials.length,
      activeCourses: data.courses.filter((course) => course.status !== "completed").length,
      studiedMinutesThisWeek,
    },
  };
}
