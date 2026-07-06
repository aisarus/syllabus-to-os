import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { PageHeader } from "@/components/app-shell";
import { useApp } from "@/lib/app-context";
import { useData } from "@/lib/store";

export const Route = createFileRoute("/app/progress")({
  component: ProgressPage,
});

function Bar({ value, label, sub }: { value: number; label: string; sub?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm">{label}</span>
        <span className="text-sm font-bold">{pct}%</span>
      </div>
      <div className="h-2 bg-background rounded-full overflow-hidden">
        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      {sub && <div className="text-[11px] text-muted-foreground mt-2">{sub}</div>}
    </div>
  );
}

function ProgressPage() {
  const { t } = useApp();
  const data = useData();

  const overall = useMemo(() => {
    const totalCourses = data.courses.length;
    const doneCourses = data.courses.filter((c) => c.status === "completed").length;
    const totalTopics = data.topics.length;
    const understood = data.topics.filter((tp) => tp.status === "understood").length;
    const totalCards = data.flashcards.length;
    const mastered = data.flashcards.filter((c) => c.status === "mastered").length;
    const totalAssign = data.assignments.length;
    const submitted = data.assignments.filter((a) => a.status === "submitted" || a.status === "graded").length;
    const avgQuiz = data.quizAttempts.length === 0 ? 0 : Math.round(data.quizAttempts.reduce((s, a) => s + a.score, 0) / data.quizAttempts.length);
    return {
      courseProgress: totalCourses === 0 ? 0 : (doneCourses / totalCourses) * 100,
      topicProgress: totalTopics === 0 ? 0 : (understood / totalTopics) * 100,
      cardProgress: totalCards === 0 ? 0 : (mastered / totalCards) * 100,
      assignProgress: totalAssign === 0 ? 0 : (submitted / totalAssign) * 100,
      avgQuiz,
      totalCourses, doneCourses, totalTopics, understood, totalCards, mastered, totalAssign, submitted,
    };
  }, [data]);

  const perCourse = useMemo(() => {
    return data.courses.map((c) => {
      const topics = data.topics.filter((tp) => tp.courseId === c.id);
      const topicsDone = topics.filter((tp) => tp.status === "understood").length;
      const topicPct = topics.length ? (topicsDone / topics.length) * 100 : 0;

      const quizzes = data.quizzes.filter((q) => q.courseId === c.id);
      const quizIds = new Set(quizzes.map((q) => q.id));
      const cAttempts = data.quizAttempts.filter((a) => quizIds.has(a.quizId));
      const bestByQuiz = new Map<string, number>();
      for (const a of cAttempts) bestByQuiz.set(a.quizId, Math.max(bestByQuiz.get(a.quizId) ?? 0, a.score));
      const quizPct = bestByQuiz.size ? [...bestByQuiz.values()].reduce((s, v) => s + v, 0) / bestByQuiz.size : 0;

      const cards = data.flashcards.filter((f) => f.courseId === c.id);
      const cardsMastered = cards.filter((f) => f.status === "mastered").length;
      const cardPct = cards.length ? (cardsMastered / cards.length) * 100 : 0;

      const assigns = data.assignments.filter((a) => a.courseId === c.id);
      const assignsDone = assigns.filter((a) => a.status === "submitted" || a.status === "graded").length;
      const assignPct = assigns.length ? (assignsDone / assigns.length) * 100 : 0;

      const notesCount = data.notes.filter((n) => n.courseId === c.id).length;
      const upcoming = data.calendarEvents.filter((e) => e.courseId === c.id && e.date >= new Date().toISOString().slice(0, 10)).length;

      const readiness = 0.4 * topicPct + 0.25 * quizPct + 0.2 * cardPct + 0.15 * assignPct;

      return {
        course: c,
        topicPct, quizPct, cardPct, assignPct,
        topics: topics.length, topicsDone,
        cards: cards.length, cardsMastered,
        assigns: assigns.length, assignsDone,
        bestQuiz: bestByQuiz.size ? Math.max(...bestByQuiz.values()) : 0,
        notesCount, upcoming,
        readiness,
      };
    });
  }, [data]);

  const isEmpty = data.courses.length + data.topics.length + data.flashcards.length + data.assignments.length + data.quizAttempts.length === 0;

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader title={t.progress} subtitle={t.readinessFormula} />
      {isEmpty ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center text-muted-foreground">
          {t.empty}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
            <Bar value={overall.courseProgress} label={t.courses} sub={`${overall.doneCourses}/${overall.totalCourses}`} />
            <Bar value={overall.topicProgress} label={t.topics} sub={`${overall.understood}/${overall.totalTopics}`} />
            <Bar value={overall.cardProgress} label={t.flashcards} sub={`${overall.mastered}/${overall.totalCards}`} />
            <Bar value={overall.assignProgress} label={t.assignments} sub={`${overall.submitted}/${overall.totalAssign}`} />
            <Bar value={overall.avgQuiz} label={t.quizAvg} sub={`${data.quizAttempts.length} ${t.attempts}`} />
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="text-sm">{t.notes}</div>
              <div className="text-3xl font-bold mt-2">{data.notes.length}</div>
            </div>
          </div>

          <h2 className="text-sm font-semibold mb-2">{t.courses}</h2>
          <div className="space-y-2">
            {perCourse.map((p) => (
              <div key={p.course.id} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-center justify-between mb-2">
                  <Link to="/app/courses/$courseId" params={{ courseId: p.course.id }} className="font-medium hover:underline">
                    {p.course.title}
                  </Link>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">{t.readinessScore}</div>
                    <div className="text-lg font-bold">{Math.round(p.readiness)}%</div>
                  </div>
                </div>
                <div className="h-1.5 bg-background rounded-full overflow-hidden mb-3">
                  <div className="h-full bg-primary" style={{ width: `${Math.round(p.readiness)}%` }} />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
                  <div>{t.topics}: {p.topicsDone}/{p.topics}</div>
                  <div>{t.quizAvg}: {Math.round(p.quizPct)}%</div>
                  <div>{t.flashcards}: {p.cardsMastered}/{p.cards}</div>
                  <div>{t.assignments}: {p.assignsDone}/{p.assigns}</div>
                  <div>{t.notes}: {p.notesCount}</div>
                  <div>{t.upcoming}: {p.upcoming}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
