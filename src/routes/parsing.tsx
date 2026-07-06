import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, FileText, Network, Layers, HelpCircle, Sparkles } from "lucide-react";

export const Route = createFileRoute("/parsing")({
  head: () => ({ meta: [{ title: "מנתח סילבוס · Lamdan AI" }] }),
  component: Parsing,
});

const steps = [
  { icon: FileText, label: "קורא את הקובץ" },
  { icon: FileText, label: "מזהה מבנה אקדמי ישראלי" },
  { icon: FileText, label: "מחלץ קורסים ומספרי קורס" },
  { icon: FileText, label: "מזהה שנים וסמסטרים" },
  { icon: FileText, label: "מזהה נקודות זכות (נ״ז)" },
  { icon: FileText, label: "מזהה דרישות קדם" },
  { icon: FileText, label: "מזהה מטלות ופרויקטים" },
  { icon: FileText, label: "מזהה מבחנים · מועד א׳ / מועד ב׳" },
  { icon: Network, label: "בונה מפת קורסים וגרף ידע" },
  { icon: Sparkles, label: "יוצר סביבת לימוד אישית" },
  { icon: Layers, label: "מייצר כרטיסיות ראשוניות" },
  { icon: HelpCircle, label: "מייצר בחנים לפי נושאים" },
];

function Parsing() {
  const nav = useNavigate();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (i >= steps.length) {
      const t = setTimeout(() => nav({ to: "/preview" }), 600);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setI((v) => v + 1), 350);
    return () => clearTimeout(t);
  }, [i, nav]);

  return (
    <div dir="rtl" className="min-h-screen bg-background gradient-hero grid-bg flex items-center justify-center px-4">
      <div className="w-full max-w-2xl glass-panel rounded-2xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">מעבד את הסילבוס שלך…</div>
            <h1 className="text-xl font-bold">ניתוח AI פועל</h1>
          </div>
        </div>
        <div className="space-y-2">
          {steps.map((s, idx) => {
            const done = idx < i;
            const active = idx === i;
            return (
              <div key={s.label} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition ${active ? "bg-primary/10 border border-primary/30" : done ? "bg-surface" : "opacity-40"}`}>
                {done ? (
                  <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                ) : active ? (
                  <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
                ) : (
                  <div className="h-4 w-4 rounded-full border border-border shrink-0" />
                )}
                <span className={`text-sm ${active ? "text-foreground font-medium" : done ? "text-muted-foreground" : ""}`}>{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
