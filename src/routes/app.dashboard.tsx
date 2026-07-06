import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/app-context";
import { useData, store, loadSampleBarIlan } from "@/lib/store";
import { BookOpen, FileText, Layers, ClipboardList, Plus, Sparkles } from "lucide-react";

export const Route = createFileRoute("/app/dashboard")({
  component: Dashboard,
});

function Stat({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="mt-1 text-3xl font-bold">{value}</div>
    </div>
  );
}

function Dashboard() {
  const { t, lang } = useApp();
  const data = useData();

  const stats = useMemo(() => {
    const now = Date.now();
    const total = data.courses.length;
    const inProgress = data.courses.filter((c) => c.status === "in_progress").length;
    const completed = data.courses.filter((c) => c.status === "completed").length;
    const dueAssign = data.assignments.filter(
      (a) => a.status !== "graded" && a.status !== "submitted",
    ).length;
    const cardsDue = data.flashcards.filter((c) => c.dueAt <= now).length;
    const attempts = data.quizAttempts;
    const avg =
      attempts.length === 0
        ? "—"
        : `${Math.round(attempts.reduce((s, a) => s + a.score, 0) / attempts.length)}%`;
    return { total, inProgress, completed, dueAssign, cardsDue, avg };
  }, [data]);

  const isEmpty =
    data.courses.length === 0 &&
    data.notes.length === 0 &&
    data.assignments.length === 0 &&
    data.flashcards.length === 0;

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title={t.dashboard}
        subtitle={lang === "ru" ? "Ваши текущие показатели" : "Your current activity"}
      />
      {isEmpty ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center">
          <p className="text-muted-foreground mb-4">{t.emptyDashboard}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link to="/app/program">
              <Button>
                <Plus className="h-4 w-4 me-1" />
                {t.createProgram}
              </Button>
            </Link>
            <Button variant="outline" onClick={loadSampleBarIlan}>
              <Sparkles className="h-4 w-4 me-1" />
              {t.loadSample}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Stat label={t.totalCourses} value={stats.total} icon={BookOpen} />
            <Stat label={t.inProgress} value={stats.inProgress} icon={BookOpen} />
            <Stat label={t.completed} value={stats.completed} icon={BookOpen} />
            <Stat label={t.assignmentsDue} value={stats.dueAssign} icon={ClipboardList} />
            <Stat label={t.notesCount} value={data.notes.length} icon={FileText} />
            <Stat label={t.cardsDue} value={stats.cardsDue} icon={Layers} />
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="text-sm font-semibold mb-3">{t.courses}</div>
              {data.courses.length === 0 && (
                <div className="text-xs text-muted-foreground">{t.empty}</div>
              )}
              <div className="space-y-2">
                {data.courses.slice(0, 6).map((c) => (
                  <Link
                    key={c.id}
                    to="/app/courses/$courseId"
                    params={{ courseId: c.id }}
                    className="flex items-center gap-3 rounded-md p-2 hover:bg-accent"
                  >
                    <span className="text-xs font-mono text-muted-foreground w-12">
                      {c.number || "—"}
                    </span>
                    <span className="flex-1 truncate text-sm">{c.title}</span>
                    <span className="text-[10px] text-muted-foreground uppercase">
                      {c.status.replace("_", " ")}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="text-sm font-semibold mb-3">{t.quizAvg}</div>
              <div className="text-4xl font-bold">{stats.avg}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {t.attempts}: {data.quizAttempts.length}
              </div>
              <div className="text-xs text-muted-foreground mt-4">
                Data stored locally · {Object.values(data).reduce((s, v) => s + (Array.isArray(v) ? v.length : 0), 0)} items
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="mt-3"
                onClick={() => {
                  if (confirm(t.clearConfirm)) store.reset();
                }}
              >
                {t.clearAll}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
