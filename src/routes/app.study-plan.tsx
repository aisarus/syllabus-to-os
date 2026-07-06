import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/app-context";
import { useData, store } from "@/lib/store";
import { Check, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/app/study-plan")({
  component: StudyPlanPage,
});

type Suggestion = {
  id: string;
  title: string;
  reason: string;
  minutes: number;
  linkedEntityType?: string;
  linkedEntityId?: string;
};

const OPTIONS = [15, 30, 60, 120];

function StudyPlanPage() {
  const { t } = useApp();
  const data = useData();
  const [available, setAvailable] = useState(30);
  const [seed, setSeed] = useState(0);

  const suggestions = useMemo<Suggestion[]>(() => {
    const now = Date.now();
    const today = new Date().toISOString().slice(0, 10);
    const in7 = new Date(now + 7 * 86400000).toISOString().slice(0, 10);
    const out: Suggestion[] = [];

    const dueCards = data.flashcards.filter((c) => c.dueAt <= now);
    if (dueCards.length > 0) {
      out.push({
        id: "cards_due",
        title: `${t.review}: ${dueCards.length} ${t.flashcards}`,
        reason: `${dueCards.length} ${t.planWhyCardsDue}`,
        minutes: Math.min(30, Math.max(5, Math.ceil(dueCards.length * 0.5))),
        linkedEntityType: "flashcards",
      });
    }

    const quizStats = new Map<string, number>();
    for (const q of data.quizzes) {
      const attempts = data.quizAttempts.filter((a) => a.quizId === q.id);
      if (attempts.length > 0) {
        const best = attempts.reduce((m, a) => Math.max(m, a.score), 0);
        quizStats.set(q.id, best);
      }
    }
    for (const [quizId, best] of quizStats) {
      if (best < 70) {
        const q = data.quizzes.find((x) => x.id === quizId)!;
        out.push({
          id: `quiz_${quizId}`,
          title: `${t.retry}: ${q.title}`,
          reason: `${t.planWhyLowScore} (${best}%)`,
          minutes: 15,
          linkedEntityType: "quiz",
          linkedEntityId: quizId,
        });
      }
    }

    for (const tp of data.topics.filter((tp) => tp.status === "learning").slice(0, 5)) {
      const course = data.courses.find((c) => c.id === tp.courseId);
      out.push({
        id: `topic_${tp.id}`,
        title: `${t.understood}: ${tp.title}`,
        reason: `${t.planWhyLearning}${course ? ` · ${course.title}` : ""}`,
        minutes: 20,
        linkedEntityType: "topic",
        linkedEntityId: tp.id,
      });
    }

    for (const a of data.assignments) {
      if (!a.dueDate) continue;
      if (a.status === "submitted" || a.status === "graded") continue;
      if (a.dueDate <= in7) {
        const days = Math.max(0, Math.ceil((new Date(a.dueDate).getTime() - now) / 86400000));
        out.push({
          id: `assign_${a.id}`,
          title: a.title,
          reason: `${t.planWhyDeadline} · ${days}d`,
          minutes: 25,
          linkedEntityType: "assignment",
          linkedEntityId: a.id,
        });
      }
    }

    for (const ev of data.calendarEvents) {
      if (ev.type !== "exam") continue;
      if (ev.date >= today && ev.date <= in7) {
        out.push({
          id: `exam_${ev.id}`,
          title: `${t.exam}: ${ev.title}`,
          reason: t.planWhyExamSoon,
          minutes: 45,
          linkedEntityType: "event",
          linkedEntityId: ev.id,
        });
      }
    }

    for (const c of data.courses.filter((c) => c.status === "in_progress")) {
      const hasRecent =
        data.notes.some((n) => n.courseId === c.id && now - n.updatedAt < 7 * 86400000) ||
        data.flashcards.some((f) => f.courseId === c.id && now - f.createdAt < 7 * 86400000) ||
        data.quizAttempts.some((a) => {
          const q = data.quizzes.find((qq) => qq.id === a.quizId);
          return q?.courseId === c.id && now - a.takenAt < 7 * 86400000;
        });
      if (!hasRecent) {
        out.push({
          id: `stale_${c.id}`,
          title: `${c.title}`,
          reason: t.planWhyStaleCourse,
          minutes: 20,
          linkedEntityType: "course",
          linkedEntityId: c.id,
        });
      }
    }

    // Fit within available time
    const fit: Suggestion[] = [];
    let sum = 0;
    for (const s of out) {
      if (sum + s.minutes <= available) {
        fit.push(s);
        sum += s.minutes;
      }
    }
    return fit.length > 0 ? fit : out.slice(0, 3);
  }, [data, available, seed, t]);

  const todaySessions = useMemo(() => {
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    return data.studySessions.filter((s) => s.completedAt >= startOfDay.getTime());
  }, [data.studySessions]);

  const markDone = (s: Suggestion) => {
    store.logSession({
      title: s.title,
      type: s.linkedEntityType ?? "custom",
      linkedEntityType: s.linkedEntityType,
      linkedEntityId: s.linkedEntityId,
      durationMinutes: s.minutes,
    });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader title={t.studyPlan} subtitle={t.studyPlanIntro} />
      <div className="rounded-lg border border-border bg-surface p-4 mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm me-2">{t.availableTime}:</span>
        {OPTIONS.map((n) => (
          <Button key={n} size="sm" variant={available === n ? "default" : "outline"} onClick={() => setAvailable(n)}>
            {n} {t.minutes}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={() => setSeed((v) => v + 1)}>
          <RefreshCw className="h-3.5 w-3.5 me-1" />{t.reset}
        </Button>
      </div>

      {suggestions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center text-muted-foreground">
          {t.emptyPlan}
        </div>
      ) : (
        <div className="space-y-2">
          {suggestions.map((s) => (
            <div key={s.id} className="rounded-lg border border-border bg-surface p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{s.title}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {t.reason}: {s.reason} · {t.estimated} {s.minutes} {t.minutes}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => markDone(s)}>
                <Check className="h-4 w-4 me-1" />{t.markDone}
              </Button>
            </div>
          ))}
        </div>
      )}

      {todaySessions.length > 0 && (
        <>
          <h2 className="text-sm font-semibold mt-8 mb-2">{t.planCompletedToday}</h2>
          <div className="space-y-1.5">
            {todaySessions.map((s) => (
              <div key={s.id} className="rounded border border-border bg-surface p-2 text-xs flex justify-between">
                <span>{s.title}</span>
                <span className="text-muted-foreground">{s.durationMinutes} {t.minutes}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
