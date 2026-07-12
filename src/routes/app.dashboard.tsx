import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/app-context";
import { useData, store, loadSampleBarIlan } from "@/lib/store";
import {
  BookOpen, FileText, Layers, ClipboardList, Plus, Sparkles, HelpCircle,
  CalendarDays, FolderOpen, Target,
} from "lucide-react";

export const Route = createFileRoute("/app/dashboard")({
  component: Dashboard,
});

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-border bg-surface p-4 ${className}`}>{children}</div>;
}

function Stat({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Card>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="mt-1 text-3xl font-bold">{value}</div>
    </Card>
  );
}

function Dashboard() {
  const { t } = useApp();
  const data = useData();

  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date(now + 7 * 86400000).toISOString().slice(0, 10);

  const stats = useMemo(() => {
    const total = data.courses.length;
    const inProgress = data.courses.filter((c) => c.status === "in_progress").length;
    const completed = data.courses.filter((c) => c.status === "completed").length;
    const dueAssign = data.assignments.filter((a) => a.status !== "graded" && a.status !== "submitted").length;
    const cardsDue = data.flashcards.filter((c) => c.dueAt <= now).length;
    const attempts = data.quizAttempts;
    const avg = attempts.length === 0 ? "—" : `${Math.round(attempts.reduce((s, a) => s + a.score, 0) / attempts.length)}%`;
    return { total, inProgress, completed, dueAssign, cardsDue, avg };
  }, [data, now]);

  const todayEvents = data.calendarEvents.filter((e) => e.date === today);
  const upcomingDeadlines = data.assignments
    .filter((a) => a.dueDate && a.dueDate >= today && a.dueDate <= in7 && a.status !== "submitted" && a.status !== "graded")
    .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""))
    .slice(0, 5);
  const upcomingExams = data.calendarEvents
    .filter((e) => e.type === "exam" && e.date >= today && e.date <= in7)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);
  const recentMaterials = [...data.materials]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 5);
  const recentNotes = [...data.notes].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);
  const lowScoreQuizzes = data.quizzes
    .map((q) => {
      const attempts = data.quizAttempts.filter((a) => a.quizId === q.id);
      const best = attempts.reduce((m, a) => Math.max(m, a.score), 0);
      return { q, best, count: attempts.length };
    })
    .filter((x) => x.count > 0 && x.best < 70)
    .slice(0, 5);
  const activeCourses = data.courses.filter((c) => c.status === "in_progress").slice(0, 6);

  const chunkCounts = new Map<string, number>();
  data.materialChunks.forEach((c) => chunkCounts.set(c.materialId, (chunkCounts.get(c.materialId) || 0) + 1));
  const outputCounts = new Map<string, number>();
  data.materialOutputs.forEach((o) => outputCounts.set(o.materialId, (outputCounts.get(o.materialId) || 0) + 1));

  const unsupportedMaterials = data.materials
    .filter((m) => m.processingStatus === "unsupported" || m.processingStatus === "no_text" || m.processingStatus === "error")
    .slice(0, 5);
  const materialsNoCourse = data.materials.filter((m) => !m.courseId).slice(0, 5);
  const chunksNoOutputs = data.materials
    .filter((m) => (chunkCounts.get(m.id) || 0) > 0 && (outputCounts.get(m.id) || 0) === 0)
    .slice(0, 5);
  const latestMaterial = recentMaterials[0];

  const isEmpty =
    data.courses.length === 0 &&
    data.notes.length === 0 &&
    data.materials.length === 0 &&
    data.assignments.length === 0 &&
    data.flashcards.length === 0;

  const hour = new Date().getHours();
  const greeting = hour < 5
    ? (t as any).goodNight ?? "Good night"
    : hour < 12
      ? (t as any).goodMorning ?? "Good morning"
      : hour < 18
        ? (t as any).goodAfternoon ?? "Good afternoon"
        : (t as any).goodEvening ?? "Good evening";
  const tagline = (t as any).heroTagline ?? "Focus, learn, and grow — one page at a time.";

  return (
    <div className="max-w-6xl mx-auto">
      <section className="relative overflow-hidden rounded-2xl border border-border gradient-hero p-8 md:p-10 mb-8 shadow-elegant">
        <div className="relative z-10 max-w-2xl">
          <div className="text-[11px] uppercase tracking-[0.2em] text-brass/80 mb-3">
            {new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
          </div>
          <h1 className="font-display text-3xl md:text-5xl font-semibold leading-[1.05] tracking-tight">
            {greeting},<br />
            <span className="text-gradient">let&rsquo;s continue your journey.</span>
          </h1>
          <p className="mt-4 text-sm text-muted-foreground max-w-md">{tagline}</p>
        </div>
        <div className="pointer-events-none absolute -right-16 -bottom-20 h-64 w-64 rounded-full bg-brass/10 blur-3xl" />
      </section>

      {isEmpty ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center">
          <p className="text-muted-foreground mb-4">{t.emptyDashboard}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link to="/app/program"><Button><Plus className="h-4 w-4 me-1" />{t.createProgram}</Button></Link>
            <Link to="/app/courses"><Button variant="outline"><Plus className="h-4 w-4 me-1" />{t.createCourse}</Button></Link>
            <Link to="/app/materials"><Button variant="outline"><FolderOpen className="h-4 w-4 me-1" />{t.createMaterial}</Button></Link>
            <Button variant="outline" onClick={loadSampleBarIlan}><Sparkles className="h-4 w-4 me-1" />{t.loadSample}</Button>
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
            <Card>
              <div className="text-sm font-semibold mb-3 flex items-center gap-2"><CalendarDays className="h-4 w-4" />{t.todaysSchedule}</div>
              {todayEvents.length === 0 ? (
                <div className="text-xs text-muted-foreground">{t.empty}</div>
              ) : (
                <div className="space-y-1.5">
                  {todayEvents.map((e) => (
                    <div key={e.id} className="text-sm flex justify-between">
                      <span className="truncate">{e.title}</span>
                      <span className="text-xs text-muted-foreground">{e.startTime || ""}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <div className="text-sm font-semibold mb-3 flex items-center gap-2"><ClipboardList className="h-4 w-4" />{t.upcomingDeadlines}</div>
              {upcomingDeadlines.length === 0 ? (
                <div className="text-xs text-muted-foreground">{t.empty}</div>
              ) : (
                <div className="space-y-1.5">
                  {upcomingDeadlines.map((a) => (
                    <div key={a.id} className="text-sm flex justify-between">
                      <span className="truncate">{a.title}</span>
                      <span className="text-xs text-muted-foreground">{a.dueDate}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <div className="text-sm font-semibold mb-3 flex items-center gap-2"><Target className="h-4 w-4" />{t.upcomingExams}</div>
              {upcomingExams.length === 0 ? (
                <div className="text-xs text-muted-foreground">{t.empty}</div>
              ) : (
                <div className="space-y-1.5">
                  {upcomingExams.map((e) => (
                    <div key={e.id} className="text-sm flex justify-between">
                      <span className="truncate">{e.title}</span>
                      <span className="text-xs text-muted-foreground">{e.date}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <div className="text-sm font-semibold mb-3 flex items-center gap-2"><HelpCircle className="h-4 w-4" />{t.lowScoreQuizzes}</div>
              {lowScoreQuizzes.length === 0 ? (
                <div className="text-xs text-muted-foreground">{t.empty}</div>
              ) : (
                <div className="space-y-1.5">
                  {lowScoreQuizzes.map(({ q, best }) => (
                    <Link key={q.id} to="/app/quizzes/$quizId" params={{ quizId: q.id }} className="text-sm flex justify-between hover:bg-accent rounded px-1 -mx-1">
                      <span className="truncate">{q.title}</span>
                      <span className="text-xs text-muted-foreground">{best}%</span>
                    </Link>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <div className="text-sm font-semibold mb-3 flex items-center gap-2"><BookOpen className="h-4 w-4" />{t.activeCourses}</div>
              {activeCourses.length === 0 ? (
                <div className="text-xs text-muted-foreground">{t.empty}</div>
              ) : (
                <div className="space-y-1.5">
                  {activeCourses.map((c) => (
                    <Link key={c.id} to="/app/courses/$courseId" params={{ courseId: c.id }} className="text-sm flex justify-between hover:bg-accent rounded px-1 -mx-1">
                      <span className="truncate">{c.title}</span>
                      <span className="text-xs font-mono text-muted-foreground">{c.number || ""}</span>
                    </Link>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <div className="text-sm font-semibold mb-3 flex items-center gap-2"><FolderOpen className="h-4 w-4" />{t.recentMaterials}</div>
              {recentMaterials.length === 0 ? (
                <div className="text-xs text-muted-foreground">{t.empty}</div>
              ) : (
                <div className="space-y-1.5">
                  {recentMaterials.map((m) => (
                    <Link key={m.id} to="/app/materials/$materialId" params={{ materialId: m.id }} className="text-sm truncate block hover:bg-accent rounded px-1 -mx-1">
                      {m.title}
                    </Link>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <div className="text-sm font-semibold mb-3 flex items-center gap-2"><FileText className="h-4 w-4" />{t.recentNotes}</div>
              {recentNotes.length === 0 ? (
                <div className="text-xs text-muted-foreground">{t.empty}</div>
              ) : (
                <div className="space-y-1.5">
                  {recentNotes.map((n) => (
                    <div key={n.id} className="text-sm truncate">{n.title || "Untitled"}</div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <div className="text-sm font-semibold mb-3 flex items-center gap-2"><Target className="h-4 w-4" />{t.suggestedPlan}</div>
              <Link to="/app/study-plan" className="text-sm text-primary hover:underline">{t.open} →</Link>
              <div className="mt-3 text-xs text-muted-foreground">{t.quizAvg}: <span className="font-bold text-foreground">{stats.avg}</span></div>
              <Button
                size="sm" variant="ghost" className="mt-3"
                onClick={() => { if (confirm(t.clearConfirm)) store.reset(); }}
              >{t.clearAll}</Button>
            </Card>
          </div>

          <div className="mt-6">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase mb-2">{t.needsAttention}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card>
                <div className="text-sm font-semibold mb-3 flex items-center gap-2"><FolderOpen className="h-4 w-4" />{t.unsupportedFiles}</div>
                {unsupportedMaterials.length === 0 ? (
                  <div className="text-xs text-muted-foreground">{t.empty}</div>
                ) : (
                  <div className="space-y-1.5">
                    {unsupportedMaterials.map((m) => (
                      <Link key={m.id} to="/app/materials/$materialId" params={{ materialId: m.id }} className="text-sm block hover:bg-accent rounded px-1 -mx-1 truncate">
                        {m.title}
                      </Link>
                    ))}
                  </div>
                )}
              </Card>
              <Card>
                <div className="text-sm font-semibold mb-3 flex items-center gap-2"><FolderOpen className="h-4 w-4" />{t.materialsWithoutCourse}</div>
                {materialsNoCourse.length === 0 ? (
                  <div className="text-xs text-muted-foreground">{t.empty}</div>
                ) : (
                  <div className="space-y-1.5">
                    {materialsNoCourse.map((m) => (
                      <Link key={m.id} to="/app/materials/$materialId" params={{ materialId: m.id }} className="text-sm block hover:bg-accent rounded px-1 -mx-1 truncate">
                        {m.title}
                      </Link>
                    ))}
                  </div>
                )}
              </Card>
              <Card>
                <div className="text-sm font-semibold mb-3 flex items-center gap-2"><Layers className="h-4 w-4" />{t.materialsWithChunksNoOutputs}</div>
                {chunksNoOutputs.length === 0 ? (
                  <div className="text-xs text-muted-foreground">{t.empty}</div>
                ) : (
                  <div className="space-y-1.5">
                    {chunksNoOutputs.map((m) => (
                      <Link key={m.id} to="/app/materials/$materialId" params={{ materialId: m.id }} className="text-sm block hover:bg-accent rounded px-1 -mx-1 truncate">
                        {m.title} <span className="text-xs text-muted-foreground">· {chunkCounts.get(m.id)} {t.chunkCount.toLowerCase()}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </Card>
              {latestMaterial && (
                <Card>
                  <div className="text-sm font-semibold mb-3 flex items-center gap-2"><FolderOpen className="h-4 w-4" />{t.continueLatestMaterial}</div>
                  <Link to="/app/materials/$materialId" params={{ materialId: latestMaterial.id }} className="text-sm font-medium hover:underline block truncate">
                    {latestMaterial.title}
                  </Link>
                  <div className="text-xs text-muted-foreground mt-1">
                    {chunkCounts.get(latestMaterial.id) || 0} {t.chunkCount.toLowerCase()} · {outputCounts.get(latestMaterial.id) || 0} {t.outputs.toLowerCase()}
                  </div>
                </Card>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
