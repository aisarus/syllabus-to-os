import { CalendarDays, Clock3, Scale, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { todayKey, validateExamPlanningProfile } from "@/lib/exam-planning";
import { examPlanningStore, useExamPlanningData } from "@/lib/exam-planning-store";
import type { AppData } from "@/lib/store";

const WEEKDAYS_RU = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const WEEKDAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function ExamPlanningPanel({
  core,
  courseId,
  isRu,
}: {
  core: AppData;
  courseId: string;
  isRu: boolean;
}) {
  const planning = useExamPlanningData();
  const profile = planning.profiles.find((item) => item.courseId === courseId);
  const plan = profile
    ? planning.plans.find((item) => item.profileId === profile.id)
    : undefined;
  const topics = useMemo(
    () =>
      core.topics
        .filter((topic) => topic.courseId === courseId)
        .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title)),
    [core.topics, courseId],
  );
  const [examDate, setExamDate] = useState(profile?.examDate ?? addDays(todayKey(), 14));
  const [dailyMinutes, setDailyMinutes] = useState(profile?.dailyMinutes ?? 60);
  const [sessionMinutes, setSessionMinutes] = useState(profile?.sessionMinutes ?? 25);
  const [availableWeekdays, setAvailableWeekdays] = useState<number[]>(
    profile?.availableWeekdays ?? [0, 1, 2, 3, 4],
  );
  const [topicWeights, setTopicWeights] = useState<Record<string, number>>(
    profile?.topicWeights ?? {},
  );

  useEffect(() => {
    setExamDate(profile?.examDate ?? addDays(todayKey(), 14));
    setDailyMinutes(profile?.dailyMinutes ?? 60);
    setSessionMinutes(profile?.sessionMinutes ?? 25);
    setAvailableWeekdays(profile?.availableWeekdays ?? [0, 1, 2, 3, 4]);
    setTopicWeights(profile?.topicWeights ?? {});
  }, [profile?.id, courseId]);

  const validation = validateExamPlanningProfile(
    {
      courseId,
      examDate,
      dailyMinutes,
      sessionMinutes,
      availableWeekdays,
      topicWeights,
    },
    core,
    todayKey(),
  );

  const generate = () => {
    try {
      const result = examPlanningStore.saveAndGenerate({
        profileId: profile?.id,
        courseId,
        examDate,
        dailyMinutes,
        sessionMinutes,
        availableWeekdays,
        topicWeights,
        core,
      });
      toast.success(
        isRu
          ? `План создан: ${result.plan.days.length} учебных дней`
          : `Plan created: ${result.plan.days.length} study days`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <section className="mt-5 rounded-xl border border-border bg-surface p-4 md:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            <h2 className="font-serif text-xl font-semibold">
              {isRu ? "План подготовки" : "Study plan"}
            </h2>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            {isRu
              ? "Задай дату, реальный дневной бюджет и важность тем. Lamdan распределит только доступное время и не будет выдавать план за прогноз оценки или готовности."
              : "Set the date, a realistic daily budget and topic importance. Lamdan allocates only available time and never presents the schedule as a grade or readiness prediction."}
          </p>
        </div>
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
          {isRu ? "Горизонт ограничен 180 днями" : "Planning horizon is capped at 180 days"}
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="rounded-lg border border-border bg-background p-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <label className="text-xs text-muted-foreground">
              {isRu ? "Дата экзамена" : "Exam date"}
              <Input
                className="mt-1"
                type="date"
                min={addDays(todayKey(), 1)}
                value={examDate}
                onChange={(event) => setExamDate(event.target.value)}
              />
            </label>
            <label className="text-xs text-muted-foreground">
              {isRu ? "Минут в доступный день" : "Minutes per available day"}
              <Input
                className="mt-1"
                type="number"
                min={10}
                max={480}
                value={dailyMinutes}
                onChange={(event) => setDailyMinutes(Number(event.target.value))}
              />
            </label>
            <label className="text-xs text-muted-foreground">
              {isRu ? "Максимум одного блока" : "Maximum session block"}
              <Input
                className="mt-1"
                type="number"
                min={5}
                max={120}
                value={sessionMinutes}
                onChange={(event) => setSessionMinutes(Number(event.target.value))}
              />
            </label>
          </div>

          <div className="mt-4">
            <span className="text-xs text-muted-foreground">
              {isRu ? "Доступные дни" : "Available weekdays"}
            </span>
            <div className="mt-2 grid grid-cols-7 gap-1">
              {(isRu ? WEEKDAYS_RU : WEEKDAYS_EN).map((label, day) => (
                <button
                  key={label}
                  type="button"
                  className={`rounded-md border px-1 py-2 text-xs ${
                    availableWeekdays.includes(day)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground"
                  }`}
                  onClick={() =>
                    setAvailableWeekdays((current) =>
                      current.includes(day)
                        ? current.filter((item) => item !== day)
                        : [...current, day].sort(),
                    )
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {validation.errors.length > 0 ? (
            <div className="mt-4 rounded-md border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-200">
              {validation.errors.map((error) => (
                <p key={error}>• {error}</p>
              ))}
            </div>
          ) : null}
          {validation.warnings.length > 0 ? (
            <div className="mt-4 rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3 text-xs text-yellow-100">
              {validation.warnings.map((warning) => (
                <p key={warning}>• {warning}</p>
              ))}
            </div>
          ) : null}

          <Button className="mt-4 w-full" disabled={!validation.ok} onClick={generate}>
            <Clock3 className="me-1 h-4 w-4" />
            {profile
              ? isRu
                ? "Пересчитать план"
                : "Rebuild plan"
              : isRu
                ? "Создать план"
                : "Create plan"}
          </Button>
          {profile ? (
            <Button
              className="mt-2 w-full"
              variant="ghost"
              onClick={() => examPlanningStore.deleteProfile(profile.id)}
            >
              <Trash2 className="me-1 h-4 w-4" />
              {isRu ? "Удалить профиль" : "Delete profile"}
            </Button>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-background p-4">
            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">{isRu ? "Веса тем" : "Topic weights"}</h3>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {isRu ? "1 — обычный приоритет, 5 — максимальная доля времени." : "1 is normal priority; 5 receives the largest time share."}
            </p>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {topics.map((topic) => (
                <label key={topic.id} className="flex items-center gap-3 rounded-md border border-border p-3 text-sm">
                  <span className="min-w-0 flex-1 truncate">{topic.title}</span>
                  <Input
                    className="w-20"
                    type="number"
                    min={1}
                    max={5}
                    value={topicWeights[topic.id] ?? 1}
                    onChange={(event) =>
                      setTopicWeights((current) => ({
                        ...current,
                        [topic.id]: Number(event.target.value),
                      }))
                    }
                  />
                </label>
              ))}
            </div>
          </div>

          {plan ? (
            <div className="rounded-lg border border-border bg-background p-4">
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <Metric label={isRu ? "Учебные дни" : "Study days"} value={plan.days.length} />
                <Metric label={isRu ? "Всего минут" : "Total minutes"} value={plan.totalMinutes} />
                <Metric label={isRu ? "Темы" : "Topics"} value={Object.keys(plan.topicTotals).length} />
              </div>
              <div className="mt-4 max-h-[420px] space-y-2 overflow-auto pe-1">
                {plan.days.slice(0, 30).map((day) => (
                  <div key={day.date} className="rounded-md border border-border p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <strong>{day.date}</strong>
                      <span className="text-muted-foreground">{day.totalMinutes} min</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {day.tasks.map((task) => (
                        <span key={task.id} className="rounded bg-primary/10 px-2 py-1 text-primary">
                          {task.topicTitle} · {task.minutes}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {plan.days.length > 30 ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  {isRu ? `Показаны первые 30 из ${plan.days.length} дней.` : `Showing the first 30 of ${plan.days.length} days.`}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-surface px-2 py-3">
      <strong className="block text-lg text-foreground">{value}</strong>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

function addDays(value: string, days: number): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}
