import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { demoFlashcards, findCourse } from "@/lib/demo-data";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RotateCcw, Sparkles } from "lucide-react";

export const Route = createFileRoute("/app/flashcards")({
  head: () => ({ meta: [{ title: "כרטיסיות · Lamdan AI" }] }),
  component: Flashcards,
});

function Flashcards() {
  const cards = demoFlashcards;
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  const card = cards[i % cards.length];
  const course = findCourse(card.courseId);

  const next = (rating?: string) => { setFlip(false); setI((v) => v + 1); void rating; };

  const stats = {
    new: cards.filter(c => c.status === "new").length,
    learning: cards.filter(c => c.status === "learning").length,
    review: cards.filter(c => c.status === "review").length,
    mastered: cards.filter(c => c.status === "mastered").length,
    due: cards.filter(c => c.dueToday).length,
  };

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto">
      <PageHeader title="כרטיסיות" subtitle="Spaced repetition · מצב טרמינולוגיה עברית-אנגלית-רוסית" actions={<Button variant="outline"><Sparkles className="me-2 h-4 w-4" /> צור מכרטיסיות מהערה</Button>} />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-6">
        {Object.entries({ "לחזרה היום": stats.due, "חדשות": stats.new, "בלמידה": stats.learning, "לחזור": stats.review, "שולטים": stats.mastered }).map(([k, v]) => (
          <Card key={k} className="p-3 bg-card border-border text-center">
            <div className="text-2xl font-bold text-gradient">{v}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{k}</div>
          </Card>
        ))}
      </div>

      <Card className="p-8 bg-card border-border min-h-[320px] flex flex-col cursor-pointer" onClick={() => setFlip(!flip)}>
        <div className="flex items-center justify-between mb-4">
          <Badge variant="secondary" className="text-[10px]">{course?.number} · {course?.titleHe}</Badge>
          <Badge variant="outline" className="text-[10px]">{card.status}</Badge>
        </div>
        <div className="flex-1 flex items-center justify-center text-center">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-3">{flip ? "תשובה" : "שאלה"}</div>
            <div className="text-2xl md:text-3xl font-bold">{flip ? card.back : card.front}</div>
            {!flip && <div className="text-xs text-muted-foreground mt-6">לחצו על הכרטיס כדי לחשוף</div>}
          </div>
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-4 gap-2">
        {[
          ["שוב", "destructive"], ["קשה", "warning"], ["טוב", "info"], ["קל", "success"],
        ].map(([l]) => (
          <Button key={l as string} disabled={!flip} onClick={() => next(l as string)} variant="outline" className="h-12">{l}</Button>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>{i + 1} מתוך {cards.length}</span>
        <button onClick={() => { setI(0); setFlip(false); }} className="hover:text-foreground flex items-center gap-1"><RotateCcw className="h-3 w-3" /> אפס סשן</button>
      </div>
    </div>
  );
}
