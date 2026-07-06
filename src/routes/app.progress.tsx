import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { PageHeader } from "@/components/app-shell";
import { useApp } from "@/lib/app-context";
import { useData } from "@/lib/store";

export const Route = createFileRoute("/app/progress")({
  component: ProgressPage,
});

function Bar({ value, label, sub }: { value: number; label: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm">{label}</span>
        <span className="text-sm font-bold">{value}%</span>
      </div>
      <div className="h-2 bg-background rounded-full overflow-hidden">
        <div className="h-full bg-primary" style={{ width: `${value}%` }} />
      </div>
      {sub && <div className="text-[11px] text-muted-foreground mt-2">{sub}</div>}
    </div>
  );
}

function ProgressPage() {
  const { t, lang } = useApp();
  const data = useData();

  const stats = useMemo(() => {
    const totalCourses = data.courses.length;
    const doneCourses = data.courses.filter((c) => c.status === "completed").length;
    const courseProgress = totalCourses === 0 ? 0 : Math.round((doneCourses / totalCourses) * 100);

    const totalTopics = data.topics.length;
    const understood = data.topics.filter((tp) => tp.status === "understood").length;
    const topicProgress = totalTopics === 0 ? 0 : Math.round((understood / totalTopics) * 100);

    const totalCards = data.flashcards.length;
    const mastered = data.flashcards.filter((c) => c.status === "mastered").length;
    const cardProgress = totalCards === 0 ? 0 : Math.round((mastered / totalCards) * 100);

    const totalAssign = data.assignments.length;
    const submitted = data.assignments.filter((a) => a.status === "submitted" || a.status === "graded").length;
    const assignProgress = totalAssign === 0 ? 0 : Math.round((submitted / totalAssign) * 100);

    const avgQuiz =
      data.quizAttempts.length === 0
        ? 0
        : Math.round(data.quizAttempts.reduce((s, a) => s + a.score, 0) / data.quizAttempts.length);

    return {
      courseProgress,
      topicProgress,
      cardProgress,
      assignProgress,
      avgQuiz,
      totalCourses,
      doneCourses,
      totalTopics,
      understood,
      totalCards,
      mastered,
      totalAssign,
      submitted,
      notesCount: data.notes.length,
    };
  }, [data]);

  const isEmpty = data.courses.length + data.topics.length + data.flashcards.length + data.assignments.length + data.quizAttempts.length === 0;

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title={t.progress}
        subtitle={lang === "ru" ? "Показатели рассчитаны из ваших действий" : "Calculated from your actual activity"}
      />
      {isEmpty ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center text-muted-foreground">
          {t.empty}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Bar value={stats.courseProgress} label={t.courses} sub={`${stats.doneCourses}/${stats.totalCourses}`} />
          <Bar value={stats.topicProgress} label={t.topics} sub={`${stats.understood}/${stats.totalTopics}`} />
          <Bar value={stats.cardProgress} label={t.flashcards} sub={`${stats.mastered}/${stats.totalCards}`} />
          <Bar value={stats.assignProgress} label={t.assignments} sub={`${stats.submitted}/${stats.totalAssign}`} />
          <Bar value={stats.avgQuiz} label={t.quizAvg} sub={`${data.quizAttempts.length} ${t.attempts}`} />
          <div className="rounded-lg border border-border bg-surface p-4">
            <div className="text-sm">{t.notes}</div>
            <div className="text-3xl font-bold mt-2">{stats.notesCount}</div>
          </div>
        </div>
      )}
    </div>
  );
}
