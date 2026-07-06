import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApp } from "@/lib/app-context";
import { useData, store, type TopicStatus } from "@/lib/store";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/app/courses/$courseId")({
  component: CoursePage,
});

function CoursePage() {
  const { courseId } = Route.useParams();
  const { t } = useApp();
  const data = useData();
  const navigate = useNavigate();
  const course = data.courses.find((c) => c.id === courseId);
  const topics = data.topics.filter((tp) => tp.courseId === courseId);
  const notes = data.notes.filter((n) => n.courseId === courseId);
  const cards = data.flashcards.filter((c) => c.courseId === courseId);
  const quizzes = data.quizzes.filter((q) => q.courseId === courseId);
  const assignments = data.assignments.filter((a) => a.courseId === courseId);
  const materials = data.materials.filter((m) => m.courseId === courseId);
  const today = new Date().toISOString().slice(0, 10);
  const events = data.calendarEvents
    .filter((e) => e.courseId === courseId && e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);
  const [newTopic, setNewTopic] = useState("");

  if (!course) {
    return (
      <div>
        <Button variant="ghost" onClick={() => navigate({ to: "/app/courses" })}>
          <ArrowLeft className="h-4 w-4 me-1" />
          {t.back}
        </Button>
        <p className="mt-4 text-muted-foreground">{t.empty}</p>
      </div>
    );
  }

  const doneTopics = topics.filter((tp) => tp.status === "understood").length;
  const progress = topics.length === 0 ? 0 : Math.round((doneTopics / topics.length) * 100);

  return (
    <div className="max-w-5xl mx-auto">
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/app/courses" })} className="mb-3">
        <ArrowLeft className="h-4 w-4 me-1" />
        {t.back}
      </Button>
      <PageHeader
        title={course.title}
        subtitle={
          <span>
            {course.number && <span className="font-mono me-2">{course.number}</span>}
            {course.originalTitle}
          </span>
        }
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-4">
          <div className="rounded-lg border border-border bg-surface p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold">{t.topics}</h2>
              <span className="text-xs text-muted-foreground">{progress}%</span>
            </div>
            <div className="h-1.5 bg-background rounded-full overflow-hidden mb-3">
              <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex gap-2 mb-3">
              <Input placeholder={t.addTopic} value={newTopic} onChange={(e) => setNewTopic(e.target.value)} />
              <Button
                onClick={() => {
                  if (!newTopic.trim()) return;
                  store.createTopic({ courseId, title: newTopic.trim(), status: "not_started" });
                  setNewTopic("");
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {topics.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t.empty}</p>
            ) : (
              <div className="space-y-1">
                {topics.map((tp) => (
                  <div key={tp.id} className="flex items-center gap-2 rounded p-2 hover:bg-accent">
                    <Input
                      className="flex-1 h-8 bg-transparent border-transparent hover:border-input"
                      value={tp.title}
                      onChange={(e) => store.updateTopic(tp.id, { title: e.target.value })}
                    />
                    <Select value={tp.status} onValueChange={(v) => store.updateTopic(tp.id, { status: v as TopicStatus })}>
                      <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not_started">{t.notStarted}</SelectItem>
                        <SelectItem value="learning">{t.learning}</SelectItem>
                        <SelectItem value="understood">{t.understood}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="icon" variant="ghost" onClick={() => store.deleteTopic(tp.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {course.description && (
            <div className="rounded-lg border border-border bg-surface p-4">
              <h2 className="text-sm font-semibold mb-2">{t.description}</h2>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{course.description}</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-surface p-4 text-xs space-y-1">
            {course.semester && <div><span className="text-muted-foreground">{t.semester}:</span> {course.semester}</div>}
            {course.credits ? <div><span className="text-muted-foreground">{t.credits}:</span> {course.credits}</div> : null}
            {course.instructor && <div><span className="text-muted-foreground">{t.instructor}:</span> {course.instructor}</div>}
            {course.prerequisites && <div><span className="text-muted-foreground">{t.prerequisites}:</span> {course.prerequisites}</div>}
            <div><span className="text-muted-foreground">{t.status}:</span> {course.status.replace("_", " ")}</div>
          </div>

          <MiniList title={t.notes} count={notes.length} linkTo="/app/notes" />
          <MiniList title={t.flashcards} count={cards.length} linkTo="/app/flashcards" />
          <MiniList title={t.quizzes} count={quizzes.length} linkTo="/app/quizzes" />
          <MiniList title={t.assignments} count={assignments.length} linkTo="/app/assignments" />
        </div>
      </div>
    </div>
  );
}

function MiniList({ title, count, linkTo }: { title: string; count: number; linkTo: string }) {
  return (
    <Link to={linkTo as never} className="block rounded-lg border border-border bg-surface p-3 hover:bg-accent">
      <div className="flex items-center justify-between">
        <span className="text-sm">{title}</span>
        <span className="text-lg font-bold">{count}</span>
      </div>
    </Link>
  );
}
