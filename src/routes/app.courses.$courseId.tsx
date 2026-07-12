import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp } from "@/lib/app-context";
import { useData, store, type CourseStatus } from "@/lib/store";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { AITopicExplainButton } from "@/components/ai-side-actions";

export const Route = createFileRoute("/app/courses/$courseId")({
  component: CoursePage,
});

function courseStatusLabel(status: CourseStatus, t: ReturnType<typeof useApp>["t"]): string {
  switch (status) {
    case "not_started":
      return t.notStarted;
    case "in_progress":
      return t.inProgress;
    case "completed":
      return t.completedStatus;
  }
}

function CoursePage() {
  const { courseId } = Route.useParams();
  const { t, lang } = useApp();
  const data = useData();
  const navigate = useNavigate();
  const course = data.courses.find((item) => item.id === courseId);
  const topics = data.topics.filter((topic) => topic.courseId === courseId);
  const notes = data.notes.filter((note) => note.courseId === courseId);
  const cards = data.flashcards.filter((card) => card.courseId === courseId);
  const quizzes = data.quizzes.filter((quiz) => quiz.courseId === courseId);
  const materials = data.materials.filter((material) => material.courseId === courseId);
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

  return (
    <div className="max-w-5xl mx-auto">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate({ to: "/app/courses" })}
        className="mb-3"
      >
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

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-4">
        <div className="space-y-4 min-w-0">
          <section className="rounded-lg border border-border bg-surface p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h2 className="text-sm font-semibold">{t.topics}</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {lang === "ru"
                    ? "Структура курса без процентов и искусственного прогресса."
                    : "Course structure without artificial progress metrics."}
                </p>
              </div>
              <span className="text-xs text-muted-foreground">{topics.length}</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 mb-3">
              <Input
                placeholder={t.addTopic}
                value={newTopic}
                onChange={(event) => setNewTopic(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" || !newTopic.trim()) return;
                  store.createTopic({ courseId, title: newTopic.trim(), status: "not_started" });
                  setNewTopic("");
                }}
              />
              <Button
                className="sm:w-auto"
                disabled={!newTopic.trim()}
                onClick={() => {
                  if (!newTopic.trim()) return;
                  store.createTopic({ courseId, title: newTopic.trim(), status: "not_started" });
                  setNewTopic("");
                }}
              >
                <Plus className="h-4 w-4 me-1" />
                {t.add}
              </Button>
            </div>
            {topics.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t.empty}</p>
            ) : (
              <div className="space-y-1">
                {topics.map((topic) => (
                  <div
                    key={topic.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-2 rounded border border-transparent p-2 hover:border-border hover:bg-accent/40"
                  >
                    <Input
                      className="flex-1 h-9 bg-transparent border-transparent hover:border-input"
                      value={topic.title}
                      aria-label={t.title}
                      onChange={(event) => store.updateTopic(topic.id, { title: event.target.value })}
                    />
                    <div className="flex items-center gap-1 self-end sm:self-auto">
                      <AITopicExplainButton topicId={topic.id} courseId={course.id} />
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={t.delete}
                        onClick={() => {
                          if (confirm(`${t.confirm}?`)) store.deleteTopic(topic.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {course.description && (
            <section className="rounded-lg border border-border bg-surface p-4">
              <h2 className="text-sm font-semibold mb-2">{t.description}</h2>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{course.description}</p>
            </section>
          )}

          <section className="rounded-lg border border-border bg-surface p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="text-sm font-semibold">
                {lang === "ru" ? "Контент курса" : "Course content"}
              </h2>
              <Link to="/app/materials" className="text-xs text-primary hover:underline">
                {t.open}
              </Link>
            </div>
            {materials.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t.empty}</p>
            ) : (
              <div className="space-y-2">
                {materials.slice(0, 6).map((material) => (
                  <Link
                    key={material.id}
                    to="/app/materials/$materialId"
                    params={{ materialId: material.id }}
                    className="flex items-center justify-between gap-3 rounded border border-border bg-background px-3 py-2 hover:bg-accent"
                  >
                    <span className="truncate text-sm">{material.title}</span>
                    <span className="text-[10px] uppercase text-muted-foreground">{material.type}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-border bg-surface p-4 text-xs space-y-2">
            {course.semester && (
              <div>
                <span className="text-muted-foreground">{t.semester}:</span> {course.semester}
              </div>
            )}
            {course.credits ? (
              <div>
                <span className="text-muted-foreground">{t.credits}:</span> {course.credits}
              </div>
            ) : null}
            {course.instructor && (
              <div>
                <span className="text-muted-foreground">{t.instructor}:</span> {course.instructor}
              </div>
            )}
            {course.prerequisites && (
              <div>
                <span className="text-muted-foreground">{t.prerequisites}:</span> {course.prerequisites}
              </div>
            )}
            <div>
              <span className="text-muted-foreground">{t.status}:</span>{" "}
              {courseStatusLabel(course.status, t)}
            </div>
          </div>

          <MiniList title={t.courseMaterials} count={materials.length} linkTo="/app/materials" />
          <MiniList title={t.notes} count={notes.length} linkTo="/app/notes" />
          <MiniList title={t.flashcards} count={cards.length} linkTo="/app/flashcards" />
          <MiniList title={t.quizzes} count={quizzes.length} linkTo="/app/quizzes" />
        </aside>
      </div>
    </div>
  );
}

function MiniList({ title, count, linkTo }: { title: string; count: number; linkTo: string }) {
  return (
    <Link
      to={linkTo as never}
      className="block rounded-lg border border-border bg-surface p-3 hover:bg-accent"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm">{title}</span>
        <span className="text-lg font-bold">{count}</span>
      </div>
    </Link>
  );
}
