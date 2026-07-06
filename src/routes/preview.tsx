import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { demoProgram } from "@/lib/demo-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ArrowRight, Pencil } from "lucide-react";

export const Route = createFileRoute("/preview")({
  head: () => ({ meta: [{ title: "תצוגה מקדימה · Lamdan AI" }] }),
  component: Preview,
});

function Preview() {
  const nav = useNavigate();
  const [program, setProgram] = useState(demoProgram);
  const grouped = program.courses.reduce<Record<string, typeof program.courses>>((acc, c) => {
    const k = `שנה ${c.year} · סמסטר ${c.semester}`;
    (acc[k] ||= []).push(c);
    return acc;
  }, {});

  return (
    <div dir="rtl" className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-success/40 bg-success/10 px-3 py-1 text-xs text-success mb-3">
              <CheckCircle2 className="h-3.5 w-3.5" /> ניתוח הושלם · זוהו {program.courses.length} קורסים
            </div>
            <h1 className="text-3xl font-bold tracking-tight">בדקו וערכו את המבנה שחילצנו</h1>
            <p className="text-sm text-muted-foreground mt-1">ניתן לערוך כל שדה. בסיום, נבנה עבורכם סביבת לימוד מלאה.</p>
          </div>
          <Button size="lg" className="gradient-primary shadow-glow" onClick={() => nav({ to: "/app/dashboard" })}>
            צור סביבת לימוד <ArrowRight className="ms-2 h-4 w-4 rtl:rotate-180" />
          </Button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
          <Meta label="מוסד" value={program.institution} onChange={(v) => setProgram({ ...program, institution: v })} />
          <Meta label="תוכנית" value={program.program} onChange={(v) => setProgram({ ...program, program: v })} />
          <Meta label="פקולטה" value={program.faculty} onChange={(v) => setProgram({ ...program, faculty: v })} />
          <Meta label="מחלקה" value={program.department} onChange={(v) => setProgram({ ...program, department: v })} />
          <Meta label="סוג תואר" value={program.degreeType} onChange={(v) => setProgram({ ...program, degreeType: v })} />
          <Meta label="שפה" value={program.language} onChange={(v) => setProgram({ ...program, language: v })} />
        </div>

        <div className="space-y-6">
          {Object.entries(grouped).map(([label, courses]) => (
            <section key={label} className="glass-panel rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold">{label}</h2>
                <Badge variant="secondary">{courses.length} קורסים · {courses.reduce((s, c) => s + c.credits, 0)} נ״ז</Badge>
              </div>
              <div className="grid md:grid-cols-2 gap-2">
                {courses.map((c) => (
                  <div key={c.id} className="group rounded-lg bg-surface p-3 flex items-start gap-3 border border-border/40 hover:border-primary/40 transition">
                    <div className="text-[10px] font-mono text-primary bg-primary/10 rounded px-1.5 py-1 mt-0.5">{c.number}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{c.titleHe}</div>
                      {c.titleEn && <div className="text-[11px] text-muted-foreground truncate">{c.titleEn}</div>}
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        <Badge variant="outline" className="text-[10px] h-5">{c.type}</Badge>
                        <Badge variant="outline" className="text-[10px] h-5">{c.credits} נ״ז</Badge>
                        {c.prerequisites.length > 0 && (
                          <Badge variant="outline" className="text-[10px] h-5">קדם: {c.prerequisites.join(", ")}</Badge>
                        )}
                      </div>
                    </div>
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="rounded-lg bg-surface p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{label}</div>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="bg-transparent border-0 h-8 px-0 focus-visible:ring-0 font-medium" />
    </div>
  );
}
