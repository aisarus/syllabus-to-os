import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { demoProgram } from "@/lib/demo-data";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/app/course-map")({
  head: () => ({ meta: [{ title: "מפת קורסים · Lamdan AI" }] }),
  component: CourseMap,
});

const statusStyle: Record<string, string> = {
  mastered: "border-success/50 bg-success/10",
  completed: "border-info/40 bg-info/5",
  studying: "border-primary/50 bg-primary/10 shadow-glow",
  risky: "border-destructive/50 bg-destructive/10",
  not_started: "border-border/60 bg-surface/60",
};
const statusLabel: Record<string, string> = {
  mastered: "שלטתי", completed: "הושלם", studying: "בלמידה", risky: "בסיכון", not_started: "טרם",
};

function CourseMap() {
  const years = [1, 2, 3];
  const semesters: ("א" | "ב")[] = ["א", "ב"];

  return (
    <div className="p-4 lg:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="מפת הקורסים"
        subtitle={`${demoProgram.program} · ${demoProgram.institution} · ${demoProgram.degreeType}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {Object.entries(statusLabel).map(([k, v]) => (
              <div key={k} className={`text-xs rounded-full border px-2.5 py-0.5 ${statusStyle[k]}`}>{v}</div>
            ))}
          </div>
        }
      />

      <div className="space-y-6">
        {years.map((y) => (
          <div key={y}>
            <div className="text-xs uppercase tracking-widest text-primary mb-2">שנה {y}</div>
            <div className="grid md:grid-cols-2 gap-4">
              {semesters.map((s) => {
                const cs = demoProgram.courses.filter((c) => c.year === y && c.semester === s);
                if (!cs.length) return null;
                return (
                  <Card key={s} className="p-4 bg-card border-border">
                    <div className="flex items-center justify-between mb-3">
                      <div className="font-semibold">סמסטר {s}׳</div>
                      <Badge variant="secondary" className="text-[10px]">{cs.length} · {cs.reduce((x, c) => x + c.credits, 0)} נ״ז</Badge>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {cs.map((c) => (
                        <Link key={c.id} to={`/app/courses/${c.id}` as never} className={`block rounded-lg border p-2.5 hover:scale-[1.02] transition ${statusStyle[c.status]}`}>
                          <div className="text-[9px] font-mono opacity-70">{c.number}</div>
                          <div className="text-xs font-semibold leading-tight mt-0.5 line-clamp-2 min-h-8">{c.titleHe}</div>
                          <div className="mt-1 flex items-center justify-between">
                            <span className="text-[9px] opacity-70">{c.credits} נ״ז</span>
                            <span className="text-[9px] opacity-70">{c.type}</span>
                          </div>
                          {c.prerequisites.length > 0 && (
                            <div className="mt-1 text-[9px] opacity-70 truncate">קדם: {c.prerequisites.join(",")}</div>
                          )}
                        </Link>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
        <div>
          <div className="text-xs uppercase tracking-widest text-primary mb-2">סמינריונים</div>
          <div className="grid md:grid-cols-3 gap-2">
            {demoProgram.courses.filter((c) => c.type === "סמינריון").map((c) => (
              <Link key={c.id} to={`/app/courses/${c.id}` as never} className="rounded-lg border border-purple/40 bg-purple/10 p-3 hover:scale-[1.02] transition">
                <div className="text-[10px] font-mono opacity-70">{c.number}</div>
                <div className="text-sm font-medium">{c.titleHe}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
