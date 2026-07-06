import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { demoProgram } from "@/lib/demo-data";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app/programs")({
  head: () => ({ meta: [{ title: "התוכניות שלי · Lamdan AI" }] }),
  component: Programs,
});

function Programs() {
  const totalCredits = demoProgram.courses.reduce((s, c) => s + c.credits, 0);
  const done = demoProgram.courses.filter((c) => c.status === "completed" || c.status === "mastered");
  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="התוכניות שלי"
        subtitle="כל התארים והתוכניות שאתה לומד או תכננת ללמוד"
        actions={<Link to="/upload"><Button className="gradient-primary"><Plus className="me-2 h-4 w-4" /> הוסף תוכנית</Button></Link>}
      />

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-6 bg-card border-border hover:border-primary/40 transition">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
              <GraduationCap className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="flex-1">
              <Badge variant="secondary" className="text-[10px] mb-2">{demoProgram.degreeType}</Badge>
              <h3 className="text-lg font-bold">{demoProgram.program}</h3>
              <div className="text-sm text-muted-foreground mt-0.5">{demoProgram.institution} · {demoProgram.faculty}</div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                <Stat label="קורסים" v={demoProgram.courses.length} />
                <Stat label="נ״ז סה״כ" v={totalCredits} />
                <Stat label="הושלמו" v={done.length} />
              </div>
              <Link to="/app/course-map" className="mt-4 inline-block text-sm text-primary hover:underline">פתח מפת קורסים →</Link>
            </div>
          </div>
        </Card>

        <Card className="p-6 border-dashed border-2 border-border bg-transparent flex items-center justify-center text-center hover:border-primary/40 transition">
          <Link to="/upload" className="block">
            <div className="h-12 w-12 rounded-xl bg-surface flex items-center justify-center mx-auto mb-3">
              <Plus className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="font-semibold">הוסף תוכנית חדשה</div>
            <div className="text-xs text-muted-foreground mt-1">מכינה, תואר שני, קורס בודד – מכל מוסד בישראל</div>
          </Link>
        </Card>
      </div>
    </div>
  );
}
function Stat({ label, v }: { label: string; v: number }) {
  return (
    <div className="rounded-lg bg-surface p-2">
      <div className="text-lg font-bold text-gradient">{v}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
