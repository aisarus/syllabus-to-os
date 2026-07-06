import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { demoProgram } from "@/lib/demo-data";
import { Brain, TrendingUp, Zap, AlertTriangle, Target } from "lucide-react";

export const Route = createFileRoute("/app/analytics")({
  head: () => ({ meta: [{ title: "אנליטיקה · Lamdan AI" }] }),
  component: Analytics,
});

function Analytics() {
  const days = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];
  const study = [45, 30, 60, 90, 25, 0, 50];
  const max = Math.max(...study);

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      <PageHeader title="אנליטיקה" subtitle="בריאות הלמידה שלך – התקדמות, מוכנות למבחנים, סיכונים" />

      <div className="grid md:grid-cols-4 gap-3 mb-6">
        <Metric icon={Brain} label="בריאות ידע" v={72} tone="primary" />
        <Metric icon={TrendingUp} label="מוכנות למבחן" v={58} tone="warning" />
        <Metric icon={Zap} label="דיוק בבחנים" v={81} tone="success" />
        <Metric icon={AlertTriangle} label="סיכון כישלון" v={22} tone="destructive" invert />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-5 bg-card border-border">
          <h3 className="font-semibold mb-4">זמן למידה שבועי (דקות)</h3>
          <div className="flex items-end gap-2 h-40">
            {study.map((v, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full rounded-t gradient-primary transition-all" style={{ height: `${(v / max) * 100}%` }} />
                <div className="text-xs text-muted-foreground">{days[i]}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 bg-card border-border">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> קורסים בסיכון</h3>
          <div className="space-y-3">
            {demoProgram.courses.filter(c => c.status === "risky" || c.status === "studying").slice(0, 5).map((c) => {
              const risk = c.status === "risky" ? 75 : 30;
              return (
                <div key={c.id}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="truncate">{c.titleHe}</span>
                    <span className={risk > 50 ? "text-destructive font-semibold" : "text-muted-foreground"}>{risk}%</span>
                  </div>
                  <Progress value={risk} className="h-1.5" />
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-5 bg-card border-border lg:col-span-3">
          <h3 className="font-semibold mb-4">התקדמות לפי סמסטר</h3>
          <div className="grid md:grid-cols-3 gap-4">
            {[1, 2, 3].map((y) => {
              const cs = demoProgram.courses.filter(c => c.year === y);
              const avg = Math.round(cs.reduce((s, c) => s + c.progress, 0) / cs.length);
              return (
                <div key={y} className="rounded-lg bg-surface p-4">
                  <div className="text-xs text-muted-foreground">שנה {y}</div>
                  <div className="text-3xl font-bold text-gradient mt-1">{avg}%</div>
                  <Progress value={avg} className="mt-2 h-1.5" />
                  <div className="mt-2 text-xs text-muted-foreground">{cs.length} קורסים · {cs.reduce((s, c) => s + c.credits, 0)} נ״ז</div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, v, tone, invert }: any) {
  const toneCls: Record<string, string> = {
    primary: "text-primary", warning: "text-warning", success: "text-success", destructive: "text-destructive",
  };
  return (
    <Card className="p-4 bg-card border-border">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${toneCls[tone]}`} />
      </div>
      <div className={`text-3xl font-bold ${invert ? toneCls[tone] : "text-gradient"}`}>{v}</div>
      <Progress value={v} className="mt-2 h-1.5" />
    </Card>
  );
}
