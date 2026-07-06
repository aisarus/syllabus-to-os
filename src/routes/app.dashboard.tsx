import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { demoProgram, demoAssignments, demoExams, demoFlashcards, findCourse } from "@/lib/demo-data";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Rocket, Target, ClipboardList, BookOpen, Flame, Brain, TrendingUp,
  AlertTriangle, Play, Zap, Layers,
} from "lucide-react";

export const Route = createFileRoute("/app/dashboard")({
  head: () => ({ meta: [{ title: "לוח בקרה · Lamdan AI" }] }),
  component: Dashboard,
});

function Dashboard() {
  const active = demoProgram.courses.filter((c) => c.status === "studying" || c.status === "risky");
  const risky = demoProgram.courses.filter((c) => c.status === "risky");
  const todayFlash = demoFlashcards.filter((f) => f.dueToday);
  const openAssign = demoAssignments.filter((a) => a.status !== "graded" && a.status !== "submitted");
  const nextExams = [...demoExams].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title={<>שלום דוד <span className="text-muted-foreground text-lg font-medium">· {demoProgram.institution} · {demoProgram.program}</span></>}
        subtitle="הנה מה שכדאי ללמוד היום כדי לעמוד בכל היעדים של השבוע."
        actions={
          <div className="flex gap-2">
            <Link to="/app/booster"><Button variant="outline"><Rocket className="me-2 h-4 w-4" /> מאיץ למידה</Button></Link>
            <Link to="/app/exam-prep"><Button className="gradient-primary shadow-glow"><Target className="me-2 h-4 w-4" /> מצב פאניקה</Button></Link>
          </div>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <Kpi icon={BookOpen} label="קורסים פעילים" value={active.length} tone="primary" />
        <Kpi icon={ClipboardList} label="מטלות פתוחות" value={openAssign.length} tone="warning" />
        <Kpi icon={Target} label="מועדי א׳ קרובים" value={demoExams.filter(e => e.moed === "א").length} tone="destructive" />
        <Kpi icon={Layers} label="כרטיסיות היום" value={todayFlash.length} tone="info" />
        <Kpi icon={Flame} label="רצף למידה" value="12" suffix="ימים" tone="primary" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Today */}
        <Card className="lg:col-span-2 p-5 bg-card border-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs text-muted-foreground">היום · חמישי, 9 יולי</div>
              <h2 className="text-lg font-bold">מה ללמוד היום</h2>
            </div>
            <Button size="sm" variant="ghost"><Play className="me-1.5 h-3.5 w-3.5" /> התחל סשן 45 דק׳</Button>
          </div>
          <div className="space-y-2">
            {[
              { c: "167", t: "לסיים את נושא 'רשתות נוירונים' (מועד א׳ בעוד 21 יום)", time: "20 דק׳", type: "study" },
              { c: "162", t: "לפתור 12 שאלות חוזרות על גרפים – נושא חלש", time: "15 דק׳", type: "quiz" },
              { c: "994b", t: "להשלים תרגיל 4 בסטטיסטיקה (דדליין ביום שלישי)", time: "40 דק׳", type: "assignment" },
              { c: "164", t: "לחזור על 8 כרטיסיות Pandas שנשכחו", time: "8 דק׳", type: "flashcards" },
            ].map((r) => (
              <div key={r.t} className="flex items-center gap-3 rounded-lg bg-surface p-3">
                <div className="text-[10px] font-mono text-primary bg-primary/10 rounded px-1.5 py-1">{r.c}</div>
                <div className="flex-1 text-sm">{r.t}</div>
                <Badge variant="secondary" className="text-[10px]">{r.time}</Badge>
              </div>
            ))}
          </div>
        </Card>

        {/* Recovery */}
        <Card className="p-5 bg-card border-border">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-8 w-8 rounded-lg bg-destructive/15 text-destructive flex items-center justify-center">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <h3 className="font-semibold">אני בפיגור</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            זוהו {risky.length} קורסים בסיכון. בנה תוכנית התאוששות מותאמת אישית לשבועיים הקרובים.
          </p>
          <div className="space-y-1.5 mb-4">
            {risky.slice(0, 3).map((c) => (
              <div key={c.id} className="flex items-center gap-2 text-sm">
                <div className="h-1.5 w-1.5 rounded-full bg-destructive" />
                <span className="truncate">{c.titleHe}</span>
              </div>
            ))}
          </div>
          <Link to="/app/booster"><Button className="w-full" variant="outline">בנה תוכנית התאוששות</Button></Link>
        </Card>

        {/* Courses */}
        <Card className="lg:col-span-2 p-5 bg-card border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold">קורסים בהתקדמות</h2>
            <Link to="/app/courses" className="text-xs text-primary hover:underline">כל הקורסים →</Link>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {active.slice(0, 6).map((c) => (
              <Link key={c.id} to={`/app/courses/${c.id}` as never} className="rounded-lg bg-surface p-3 hover:bg-surface-2 transition border border-border/40">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-muted-foreground">{c.number}</span>
                    <Badge variant={c.status === "risky" ? "destructive" : "secondary"} className="text-[10px] h-4 px-1.5">
                      {c.status === "risky" ? "בסיכון" : "בלמידה"}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">{c.progress}%</span>
                </div>
                <div className="text-sm font-medium truncate mb-2">{c.titleHe}</div>
                <Progress value={c.progress} className="h-1.5" />
              </Link>
            ))}
          </div>
        </Card>

        {/* Exams */}
        <Card className="p-5 bg-card border-border">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> מבחנים קרובים</h3>
          <div className="space-y-2">
            {nextExams.map((e) => {
              const c = findCourse(e.courseId);
              const days = Math.round((new Date(e.date).getTime() - Date.now()) / 86400000);
              return (
                <div key={e.id} className="rounded-lg bg-surface p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium truncate">{c?.titleHe}</div>
                    <Badge variant="outline" className="text-[10px]">מועד {e.moed}׳</Badge>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{e.date}</span>
                    <span className={days < 14 ? "text-destructive font-semibold" : ""}>עוד {days} ימים</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Health scores */}
        <Card className="p-5 bg-card border-border lg:col-span-3">
          <div className="grid md:grid-cols-3 gap-6">
            <Score icon={Brain} label="בריאות ידע" value={72} desc="ציון כולל של השליטה שלך בחומר" tone="primary" />
            <Score icon={TrendingUp} label="מוכנות למועד א׳" value={58} desc="ממוצע משוקלל לכל המבחנים הקרובים" tone="warning" />
            <Score icon={Zap} label="מומנטום למידה" value={84} desc="עקביות של 7 הימים האחרונים" tone="success" />
          </div>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, suffix, tone }: any) {
  const toneCls = {
    primary: "text-primary bg-primary/10",
    warning: "text-warning bg-warning/10",
    destructive: "text-destructive bg-destructive/10",
    info: "text-info bg-info/10",
  }[tone as string] || "text-primary bg-primary/10";
  return (
    <Card className="p-4 bg-card border-border">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className={`h-7 w-7 rounded-md flex items-center justify-center ${toneCls}`}><Icon className="h-3.5 w-3.5" /></div>
      </div>
      <div className="flex items-baseline gap-1.5">
        <div className="text-2xl font-bold">{value}</div>
        {suffix && <div className="text-xs text-muted-foreground">{suffix}</div>}
      </div>
    </Card>
  );
}
function Score({ icon: Icon, label, value, desc, tone }: any) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">{label}</span>
      </div>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-3xl font-bold text-gradient">{value}</span>
        <span className="text-xs text-muted-foreground">/ 100</span>
      </div>
      <Progress value={value} className="h-1.5 mb-2" />
      <p className="text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}
