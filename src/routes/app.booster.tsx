import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Rocket, Clock, Flame, AlertTriangle, Target, Play } from "lucide-react";

export const Route = createFileRoute("/app/booster")({
  head: () => ({ meta: [{ title: "מאיץ למידה · Lamdan AI" }] }),
  component: Booster,
});

const modes = [
  { id: "15", label: "מצב חירום", time: "15 דק׳", icon: AlertTriangle, desc: "המוח שלך מותש – עשה משהו אחד ותסיים" },
  { id: "30", label: "מצב רגיל", time: "30 דק׳", icon: Clock, desc: "סשן ממוקד לשיפור נושא חלש אחד" },
  { id: "60", label: "מצב עמוק", time: "60 דק׳", icon: Flame, desc: "לימוד מעמיק עם תרגול והערות" },
  { id: "recover", label: "אני בפיגור", time: "שבועיים", icon: Rocket, desc: "תוכנית התאוששות של 14 יום" },
  { id: "panic", label: "המבחן מחר", time: "אמצע לילה", icon: Target, desc: "מינימום חיוני כדי לא להיכשל" },
];

function Booster() {
  const [mode, setMode] = useState("30");

  const plan30 = [
    { t: "🔥 חזרה מהירה: 5 כרטיסיות מ-'רשתות נוירונים'", m: "3 דק׳", why: "נשכחו בסשן הקודם" },
    { t: "🎯 5 שאלות מבחן על A* Search", m: "10 דק׳", why: "מועד א׳ בעוד 21 יום · נושא חלש" },
    { t: "📖 קרא סיכום של פרק 3 – חיפוש heuristic", m: "12 דק׳", why: "נוצר אוטומטית מההרצאה" },
    { t: "✏️ סיכום ב-3 משפטים משלך", m: "5 דק׳", why: "מקבע ידע לטווח ארוך" },
  ];

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      <PageHeader title="מאיץ הלמידה" subtitle="מה ללמוד עכשיו כדי למקסם את הסיכוי לעבור ולהצטיין" />

      <div className="grid md:grid-cols-5 gap-2 mb-6">
        {modes.map((m) => (
          <button key={m.id} onClick={() => setMode(m.id)}
            className={`text-start rounded-xl p-4 border transition ${mode === m.id ? "gradient-primary border-transparent text-primary-foreground shadow-glow" : "bg-card border-border hover:border-primary/40"}`}>
            <m.icon className="h-5 w-5 mb-2" />
            <div className="font-semibold text-sm">{m.label}</div>
            <div className={`text-[11px] mt-0.5 ${mode === m.id ? "opacity-90" : "text-muted-foreground"}`}>{m.time}</div>
          </button>
        ))}
      </div>

      <Card className="p-6 bg-card border-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs text-muted-foreground">התוכנית שלך להיום</div>
            <h2 className="text-xl font-bold">{modes.find(m => m.id === mode)?.desc}</h2>
          </div>
          <Button className="gradient-primary"><Play className="me-2 h-4 w-4" /> התחל</Button>
        </div>
        <div className="space-y-2">
          {plan30.map((r, i) => (
            <div key={i} className="rounded-lg bg-surface p-3 flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">{i + 1}</div>
              <div className="flex-1">
                <div className="font-medium">{r.t}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{r.why}</div>
              </div>
              <Badge variant="outline" className="text-[10px]">{r.m}</Badge>
            </div>
          ))}
        </div>
      </Card>

      <div className="mt-6 grid md:grid-cols-3 gap-3">
        {[
          { l: "נושאים שנשכחו", v: "12", d: "לפי spaced repetition" },
          { l: "דדליינים ב-7 ימים", v: "3", d: "מטלות + מבחן" },
          { l: "פיגור מוערך", v: "-4d", d: "אתה בפיגור של 4 ימים" },
        ].map((s) => (
          <Card key={s.l} className="p-4 bg-card border-border">
            <div className="text-xs text-muted-foreground">{s.l}</div>
            <div className="text-2xl font-bold text-gradient mt-1">{s.v}</div>
            <div className="text-[11px] text-muted-foreground mt-1">{s.d}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
