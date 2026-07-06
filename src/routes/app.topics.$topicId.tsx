import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { findTopic } from "@/lib/demo-data";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Brain, Lightbulb, RefreshCw, Plus, Check, Sparkles } from "lucide-react";

export const Route = createFileRoute("/app/topics/$topicId")({
  loader: ({ params }) => {
    const r = findTopic(params.topicId);
    if (!r) throw notFound();
    return r;
  },
  head: ({ loaderData }) => ({ meta: [{ title: loaderData ? `${loaderData.topic.title} · Lamdan AI` : "נושא" }] }),
  component: TopicPage,
  notFoundComponent: () => <div className="p-8 text-center text-muted-foreground">נושא לא נמצא</div>,
});

function TopicPage() {
  const { topic, course } = Route.useLoaderData();
  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
        <Link to={`/app/courses/${course.id}` as never} className="hover:text-foreground">{course.titleHe}</Link>
        <span>/</span><span>נושא</span>
      </div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          {topic.weak && <Badge variant="destructive" className="mb-2 text-[10px]">נושא חלש · דורש חיזוק</Badge>}
          <h1 className="text-3xl font-bold">{topic.title}</h1>
          <p className="text-muted-foreground mt-1">{topic.short}</p>
        </div>
        <div className="hidden md:flex flex-col items-end">
          <div className="text-xs text-muted-foreground">ביטחון עצמי</div>
          <div className="text-3xl font-bold text-gradient">{topic.confidence}%</div>
          <Progress value={topic.confidence} className="mt-1 h-1.5 w-32" />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-6 bg-card border-border">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="h-4 w-4 text-primary" />
            <div className="font-semibold">הסבר מפורט</div>
          </div>
          <div className="prose prose-invert prose-sm max-w-none">
            <p className="leading-relaxed">{topic.detailed}</p>
            <h3>דוגמאות</h3>
            <ul>
              <li>דוגמה 1 – מתוך הרצאה 3 בקורס.</li>
              <li>דוגמה 2 – מבחן מועד א׳ סמסטר קודם.</li>
            </ul>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="outline"><Check className="me-2 h-3.5 w-3.5" /> אני מבין את זה</Button>
            <Button size="sm" variant="outline"><Lightbulb className="me-2 h-3.5 w-3.5" /> הסבר בפשטות</Button>
            <Button size="sm" variant="outline"><RefreshCw className="me-2 h-3.5 w-3.5" /> צור עוד תרגול</Button>
            <Button size="sm" variant="outline"><Plus className="me-2 h-3.5 w-3.5" /> הוסף לנושאים חלשים</Button>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-4 bg-card border-border">
            <div className="text-xs uppercase tracking-widest text-primary mb-3">מונחי מפתח</div>
            <div className="space-y-2">
              {topic.keyTerms.map((k: any) => (
                <div key={k.he} className="rounded-lg bg-surface p-2 text-xs">
                  <div className="font-semibold">{k.he}</div>
                  <div className="text-muted-foreground">EN: {k.en} {k.ru && `· RU: ${k.ru}`}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4 bg-card border-border">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <div className="font-semibold text-sm">משימות מיידיות</div>
            </div>
            <div className="space-y-1.5 text-sm">
              <Link to="/app/quizzes" className="block rounded bg-surface px-3 py-2 hover:bg-surface-2">🎯 בוחן מהיר – 5 שאלות</Link>
              <Link to="/app/flashcards" className="block rounded bg-surface px-3 py-2 hover:bg-surface-2">🃏 כרטיסיות נושא – 8</Link>
              <Link to="/app/tutor" className="block rounded bg-surface px-3 py-2 hover:bg-surface-2">💬 שאל את מורה ה-AI</Link>
            </div>
          </Card>

          <Card className="p-4 bg-card border-border">
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">מושגים מקושרים</div>
            <div className="flex flex-wrap gap-1.5">
              {["חיפוש heuristic", "אלגוריתם", "גרף", "עצים", "מרחב מצבים"].map((t) => (
                <Badge key={t} variant="outline" className="text-[10px]">[[{t}]]</Badge>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
