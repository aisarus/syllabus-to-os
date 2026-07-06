import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { demoProgram } from "@/lib/demo-data";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export const Route = createFileRoute("/app/courses")({
  head: () => ({ meta: [{ title: "קורסים · Lamdan AI" }] }),
  component: Courses,
});

function Courses() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("all");

  const filtered = demoProgram.courses.filter((c) => {
    const okQ = !q || c.titleHe.includes(q) || c.number.includes(q) || c.titleEn?.toLowerCase().includes(q.toLowerCase());
    const okF = filter === "all" || c.status === filter;
    return okQ && okF;
  });

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <PageHeader title="קורסים" subtitle={`${filtered.length} מתוך ${demoProgram.courses.length}`} />

      <div className="flex flex-col md:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חפש קורס לפי שם או מספר..." className="ps-9 bg-surface border-border" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {[["all", "הכל"], ["studying", "בלמידה"], ["risky", "בסיכון"], ["completed", "הושלמו"], ["not_started", "טרם"]].map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} className={`text-xs rounded-full px-3 py-1.5 border transition ${filter === k ? "gradient-primary text-primary-foreground border-transparent" : "bg-surface border-border text-muted-foreground hover:text-foreground"}`}>{l}</button>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((c) => (
          <Link key={c.id} to={`/app/courses/${c.id}` as never}>
            <Card className="p-4 bg-card border-border hover:border-primary/50 transition h-full">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono text-muted-foreground">{c.number}</span>
                <Badge variant={c.status === "risky" ? "destructive" : c.status === "mastered" ? "default" : "secondary"} className="text-[10px] h-5">
                  {c.type}
                </Badge>
              </div>
              <div className="font-semibold leading-tight">{c.titleHe}</div>
              {c.titleEn && <div className="text-xs text-muted-foreground mt-0.5">{c.titleEn}</div>}
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>שנה {c.year} · סמ׳ {c.semester}׳ · {c.credits} נ״ז</span>
                <span>{c.progress}%</span>
              </div>
              <Progress value={c.progress} className="mt-2 h-1.5" />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
