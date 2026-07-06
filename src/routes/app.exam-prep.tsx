import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { demoExams, findCourse } from "@/lib/demo-data";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Target, BookOpen, Zap } from "lucide-react";

export const Route = createFileRoute("/app/exam-prep")({
  head: () => ({ meta: [{ title: "הכנה למבחן · Lamdan AI" }] }),
  component: ExamPrep,
});

function ExamPrep() {
  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      <PageHeader title="הכנה למבחן" subtitle="מועד א׳ · מועד ב׳ · תוכניות לימוד לפי ימים שנותרו" actions={
        <div className="flex gap-2">
          <Button variant="outline"><AlertTriangle className="me-2 h-4 w-4" /> המבחן מחר</Button>
          <Button className="gradient-primary"><Zap className="me-2 h-4 w-4" /> תוכנית מינימלית</Button>
        </div>
      } />

      <div className="grid md:grid-cols-2 gap-4">
        {demoExams.map((e) => {
          const c = findCourse(e.courseId);
          const days = Math.round((new Date(e.date).getTime() - Date.now()) / 86400000);
          const readiness = Math.max(15, 90 - days);
          return (
            <Card key={e.id} className="p-5 bg-card border-border">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-[10px] font-mono text-muted-foreground">{c?.number}</div>
                  <h3 className="text-lg font-bold">{c?.titleHe}</h3>
                </div>
                <Badge className={e.moed === "א" ? "gradient-primary text-primary-foreground" : ""} variant={e.moed === "ב" ? "outline" : undefined}>
                  מועד {e.moed}׳
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-4">
                <Stat l="תאריך" v={e.date} />
                <Stat l="ימים" v={String(days)} highlight={days < 14} />
                <Stat l="משקל" v={`${e.weight}%`} />
              </div>
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">מוכנות</span>
                  <span className="font-semibold">{readiness}%</span>
                </div>
                <Progress value={readiness} className="h-2" />
              </div>
              <div className="text-xs text-muted-foreground mb-2">נושאים חלשים</div>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {["רשתות נוירונים", "אלגוריתמי חיפוש", "מרחב מצבים"].map((t) => (
                  <Badge key={t} variant="destructive" className="text-[10px]">{t}</Badge>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant="outline"><BookOpen className="me-2 h-3.5 w-3.5" /> תוכנית לימוד</Button>
                <Button size="sm" className="gradient-primary"><Target className="me-2 h-3.5 w-3.5" /> סימולציה</Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
function Stat({ l, v, highlight }: { l: string; v: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg bg-surface p-2 text-center">
      <div className="text-[10px] text-muted-foreground">{l}</div>
      <div className={`text-sm font-bold ${highlight ? "text-destructive" : ""}`}>{v}</div>
    </div>
  );
}
