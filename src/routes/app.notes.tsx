import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { FileText, Sparkles, Link2, Hash, Plus, Search } from "lucide-react";
import { demoProgram } from "@/lib/demo-data";

export const Route = createFileRoute("/app/notes")({
  head: () => ({ meta: [{ title: "הערות · Lamdan AI" }] }),
  component: Notes,
});

interface Note { id: string; title: string; courseId: string; body: string; tags: string[]; }

const seed: Note[] = [
  { id: "n1", title: "הרצאה 3 – A* Search", courseId: "167", tags: ["מבחן", "AI"], body: `# A* Search\n\n**heuristic** משלב עלות ופונקציית ניחוש.\n\nמושגים קשורים: [[חיפוש heuristic]], [[BFS]], [[DFS]].\n\n- מבטיח פתרון אופטימלי כאשר h admissible\n- מורכבות זכרון: O(b^d)` },
  { id: "n2", title: "סיכום פרק – מבני נתונים", courseId: "162", tags: ["סיכום"], body: `## Stack vs Queue\n\nStack – LIFO. Queue – FIFO.\n\nראו [[רשימה מקושרת]].` },
  { id: "n3", title: "טרמינולוגיה – SQL", courseId: "733", tags: ["טרמינולוגיה", "HE-EN"], body: `- טבלה = Table\n- שאילתה = Query\n- מפתח ראשי = Primary Key` },
];

const templates = ["הערת הרצאה", "סיכום קריאה", "סיכום מבחן", "דף נוסחאות", "מושג בתכנות", "מאמר מחקר", "טרמינולוגיה עברית"];

function Notes() {
  const [notes] = useState(seed);
  const [active, setActive] = useState(notes[0]);
  const [q, setQ] = useState("");
  const filtered = notes.filter((n) => n.title.includes(q) || n.body.includes(q));

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      <div className="p-4 lg:p-6 border-b border-border">
        <PageHeader
          title="הערות"
          subtitle="מערכת הערות בסגנון Obsidian – Markdown, [[קישורים]], תגיות ו-backlinks"
          actions={<Button className="gradient-primary"><Plus className="me-2 h-4 w-4" /> הערה חדשה</Button>}
        />
      </div>
      <div className="flex-1 grid lg:grid-cols-[280px_1fr_280px] min-h-0">
        <aside className="border-e border-border p-3 overflow-y-auto bg-surface/30">
          <div className="relative mb-3">
            <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש..." className="ps-8 h-8 bg-surface border-border text-xs" />
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground px-2 mb-1">תבניות</div>
          <div className="flex flex-wrap gap-1 mb-4 px-1">
            {templates.map((t) => <Badge key={t} variant="outline" className="text-[10px] cursor-pointer">{t}</Badge>)}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground px-2 mb-1">הערות</div>
          <div className="space-y-0.5">
            {filtered.map((n) => (
              <button key={n.id} onClick={() => setActive(n)}
                className={`w-full text-start px-2 py-2 rounded-md text-sm ${active.id === n.id ? "bg-primary/15 text-foreground" : "hover:bg-surface"}`}>
                <div className="font-medium truncate flex items-center gap-2"><FileText className="h-3.5 w-3.5 text-muted-foreground" />{n.title}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{demoProgram.courses.find(c => c.id === n.courseId)?.titleHe}</div>
              </button>
            ))}
          </div>
        </aside>

        <section className="p-6 overflow-y-auto">
          <input defaultValue={active.title} key={active.id} className="w-full bg-transparent text-2xl font-bold outline-none border-0" />
          <div className="mt-1 mb-4 flex flex-wrap gap-1.5 items-center text-xs text-muted-foreground">
            <span>{demoProgram.courses.find(c => c.id === active.courseId)?.titleHe}</span>
            <span>·</span>
            {active.tags.map((t) => <Badge key={t} variant="outline" className="text-[10px]"><Hash className="h-2.5 w-2.5 me-0.5" />{t}</Badge>)}
          </div>
          <Textarea key={active.id} defaultValue={active.body}
            className="min-h-[420px] bg-surface/30 border-border font-mono text-sm leading-relaxed resize-none" />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="outline"><Sparkles className="me-2 h-3.5 w-3.5" /> סיכום AI</Button>
            <Button size="sm" variant="outline">פישוט לעברית</Button>
            <Button size="sm" variant="outline">תרגם לרוסית</Button>
            <Button size="sm" variant="outline">צור כרטיסיות</Button>
            <Button size="sm" variant="outline">צור בוחן</Button>
            <Button size="sm" variant="outline">צור מפת מושגים</Button>
          </div>
        </section>

        <aside className="hidden lg:block border-s border-border p-4 overflow-y-auto bg-surface/30">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Backlinks</div>
          <div className="space-y-1.5 mb-6">
            {["הרצאה 4 – חיפוש מקומי", "סיכום מועד א׳ 2024", "מפת מושגים – AI"].map((t) => (
              <div key={t} className="rounded-md bg-surface p-2 text-xs flex items-center gap-2">
                <Link2 className="h-3 w-3 text-primary" />{t}
              </div>
            ))}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">מקושר מ-Note זו</div>
          <div className="space-y-1.5">
            {["חיפוש heuristic", "BFS", "DFS"].map((t) => (
              <div key={t} className="rounded-md bg-surface p-2 text-xs">[[{t}]]</div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
