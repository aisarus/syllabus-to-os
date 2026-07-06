import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { demoAssignments, findCourse } from "@/lib/demo-data";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Calendar, Sparkles } from "lucide-react";

export const Route = createFileRoute("/app/assignments")({
  head: () => ({ meta: [{ title: "מטלות · Lamdan AI" }] }),
  component: Assignments,
});

function Assignments() {
  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      <PageHeader title="מטלות" subtitle="ניהול מטלות, פרויקטים ותרגילים · פירוק AI לצעדים" actions={
        <Button className="gradient-primary"><Sparkles className="me-2 h-4 w-4" /> תוכנית שבועית</Button>
      } />

      <div className="space-y-3">
        {demoAssignments.map((a) => {
          const c = findCourse(a.courseId);
          const days = Math.round((new Date(a.due).getTime() - Date.now()) / 86400000);
          return (
            <Card key={a.id} className="p-4 bg-card border-border">
              <div className="flex items-start gap-4">
                <div className="hidden sm:flex flex-col items-center bg-surface rounded-lg p-2 w-16">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground mb-1" />
                  <div className="text-xs text-muted-foreground">עוד</div>
                  <div className={`text-lg font-bold ${days < 5 ? "text-destructive" : "text-foreground"}`}>{days}</div>
                  <div className="text-[10px] text-muted-foreground">ימים</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">{c?.number}</Badge>
                    <span className="text-xs text-muted-foreground">{c?.titleHe}</span>
                    <Badge variant={a.status === "todo" ? "destructive" : "secondary"} className="text-[10px]">{a.status}</Badge>
                  </div>
                  <div className="font-semibold">{a.title}</div>
                  <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-muted-foreground">
                    <div>משקל: <span className="text-foreground font-semibold">{a.weight}%</span></div>
                    <div>קושי: <span className="text-foreground font-semibold">{"⭐".repeat(a.difficulty)}</span></div>
                    <div>זמן: <span className="text-foreground font-semibold">~{a.estimatedHours}h</span></div>
                    <div>דדליין: <span className="text-foreground font-semibold">{a.due}</span></div>
                  </div>
                  <Progress value={a.status === "in_progress" ? 45 : a.status === "submitted" ? 100 : 0} className="mt-3 h-1.5" />
                </div>
                <div className="hidden md:flex flex-col gap-1.5">
                  <Button size="sm" variant="outline" className="text-xs h-7">התחל</Button>
                  <Button size="sm" variant="outline" className="text-xs h-7">פרק ל-AI</Button>
                  <Button size="sm" variant="outline" className="text-xs h-7">סמן כהוגש</Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
