import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useApp } from "@/lib/app-context";
import { useData, store } from "@/lib/store";
import { Plus, Trash2 } from "lucide-react";
import { AIGenerateButton } from "@/components/ai-generate-dialog";

export const Route = createFileRoute("/app/quizzes")({
  component: QuizzesPage,
});

function QuizzesPage() {
  const { t } = useApp();
  const data = useData();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState("_none");

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title={t.quizzes}
        actions={
          <>
            <AIGenerateButton kind="quiz" />
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 me-1" />{t.createQuiz}</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{t.createQuiz}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>{t.title}</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
                  <div>
                    <Label>{t.linkedCourse}</Label>
                    <Select value={courseId} onValueChange={setCourseId}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">— {t.none} —</SelectItem>
                        {data.courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => setOpen(false)}>{t.cancel}</Button>
                    <Button
                      onClick={() => {
                        if (!title.trim()) return;
                        store.createQuiz({ title: title.trim(), courseId: courseId === "_none" ? undefined : courseId });
                        setTitle("");
                        setCourseId("_none");
                        setOpen(false);
                      }}
                    >{t.save}</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      {data.quizzes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center text-muted-foreground">
          {t.empty}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.quizzes.map((q) => {
            const qcount = data.quizQuestions.filter((qq) => qq.quizId === q.id).length;
            const attempts = data.quizAttempts.filter((a) => a.quizId === q.id);
            const best = attempts.reduce((m, a) => Math.max(m, a.score), 0);
            return (
              <div key={q.id} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-start justify-between">
                  <Link to="/app/quizzes/$quizId" params={{ quizId: q.id }} className="font-semibold hover:underline">
                    {q.title}
                  </Link>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm(t.confirm + "?")) store.deleteQuiz(q.id); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {qcount} · {t.attempts}: {attempts.length}
                  {attempts.length > 0 && ` · ${t.score}: ${best}%`}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
