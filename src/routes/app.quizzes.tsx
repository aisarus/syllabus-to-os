import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Sparkles, RotateCcw, Target } from "lucide-react";

export const Route = createFileRoute("/app/quizzes")({
  head: () => ({ meta: [{ title: "בחנים · Lamdan AI" }] }),
  component: Quizzes,
});

interface Q { q: string; opts: string[]; answer: number; explain: string; course: string; }
const questions: Q[] = [
  { course: "מבוא לבינה מלאכותית", q: "מהו התנאי ההכרחי לכך שאלגוריתם A* יחזיר פתרון אופטימלי?", opts: ["heuristic monotonic", "heuristic admissible (לא מגזים)", "מרחב מצבים סופי", "עלות אחידה בין צמתים"], answer: 1, explain: "כאשר h(n) ≤ עלות אמיתית לפתרון, A* מבטיח פתרון אופטימלי." },
  { course: "מבני נתונים", q: "מה סיבוכיות הזמן הממוצעת של הכנסה ל-HashMap?", opts: ["O(log n)", "O(n)", "O(1)", "O(n log n)"], answer: 2, explain: "בממוצע O(1) כאשר פונקציית ה-hash טובה." },
  { course: "מסדי נתונים", q: "איזו צורה נורמלית מבטלת תלות טרנזיטיבית?", opts: ["1NF", "2NF", "3NF", "BCNF"], answer: 2, explain: "3NF דורשת שלא תהיה תלות טרנזיטיבית של תכונות שאינן מפתח." },
  { course: "פייתון", q: "מה pandas.merge עושה?", opts: ["מכפיל DataFrame", "מבצע JOIN בין שני DataFrames", "משנה את סוג העמודות", "מסנן שורות"], answer: 1, explain: "מבצע JOIN לפי מפתחות – דומה ל-SQL JOIN." },
];

function Quizzes() {
  const [i, setI] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const q = questions[i];
  const done = i >= questions.length;

  const submit = (idx: number) => {
    if (selected !== null) return;
    setSelected(idx);
    if (idx === q.answer) setScore((s) => s + 1);
  };
  const next = () => { setSelected(null); setI((v) => v + 1); };

  if (done) {
    return (
      <div className="p-4 lg:p-8 max-w-2xl mx-auto">
        <Card className="p-10 bg-card border-border text-center">
          <div className="text-6xl mb-4">🎯</div>
          <h2 className="text-2xl font-bold">סיימת את הבוחן!</h2>
          <div className="text-5xl font-bold text-gradient mt-4">{score} / {questions.length}</div>
          <p className="text-muted-foreground mt-3">{score >= 3 ? "עבודה מצוינת. אתה מוכן למועד א׳!" : "יש עדיין עבודה. נבנה לך תוכנית שיפור."}</p>
          <div className="mt-6 flex justify-center gap-2">
            <Button onClick={() => { setI(0); setScore(0); }} className="gradient-primary"><RotateCcw className="me-2 h-4 w-4" /> שוב</Button>
            <Button variant="outline">חזור על טעויות בלבד</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto">
      <PageHeader title="בחנים" subtitle="סימולציית מועד א׳ · שאלה חוזרת מבחנים קודמים" actions={
        <div className="flex gap-2">
          <Badge variant="outline"><Target className="me-1 h-3 w-3" /> מצב בחינה</Badge>
          <Button variant="outline" size="sm"><Sparkles className="me-2 h-3.5 w-3.5" /> צור בוחן חדש</Button>
        </div>
      } />

      <div className="mb-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>שאלה {i + 1} מתוך {questions.length}</span>
        <span>{q.course}</span>
      </div>
      <div className="h-1.5 bg-surface rounded-full mb-6 overflow-hidden">
        <div className="h-full gradient-primary transition-all" style={{ width: `${((i + (selected !== null ? 1 : 0)) / questions.length) * 100}%` }} />
      </div>

      <Card className="p-6 bg-card border-border">
        <h2 className="text-xl font-semibold leading-snug">{q.q}</h2>
        <div className="mt-6 space-y-2">
          {q.opts.map((opt, idx) => {
            const isAnswer = idx === q.answer;
            const isSelected = idx === selected;
            const showState = selected !== null;
            return (
              <button key={idx} onClick={() => submit(idx)}
                className={`w-full text-start rounded-lg border p-3 transition ${
                  !showState ? "border-border hover:border-primary hover:bg-primary/5" :
                  isAnswer ? "border-success bg-success/10" :
                  isSelected ? "border-destructive bg-destructive/10" : "border-border opacity-50"
                }`}>
                <div className="flex items-center gap-3">
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${!showState ? "bg-surface" : isAnswer ? "bg-success text-white" : isSelected ? "bg-destructive text-white" : "bg-surface"}`}>
                    {showState && isAnswer ? <Check className="h-3 w-3" /> : showState && isSelected ? <X className="h-3 w-3" /> : String.fromCharCode(1488 + idx)}
                  </div>
                  <span className="flex-1">{opt}</span>
                </div>
              </button>
            );
          })}
        </div>

        {selected !== null && (
          <div className="mt-5 p-4 rounded-lg bg-primary/10 border border-primary/30">
            <div className="text-xs font-semibold text-primary mb-1">הסבר</div>
            <p className="text-sm">{q.explain}</p>
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">רמת ביטחון: 
              <div className="flex gap-1">{[1,2,3,4,5].map(n => <button key={n} className="h-6 w-6 rounded bg-surface hover:bg-primary/20 text-xs">{n}</button>)}</div>
            </div>
            <Button className="mt-4 gradient-primary w-full" onClick={next}>שאלה הבאה →</Button>
          </div>
        )}
      </Card>
    </div>
  );
}
