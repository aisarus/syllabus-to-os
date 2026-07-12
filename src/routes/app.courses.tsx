import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useApp } from "@/lib/app-context";
import { useData, store, type CourseStatus } from "@/lib/store";
import { Plus, Trash2, Pencil } from "lucide-react";

export const Route = createFileRoute("/app/courses")({
  component: CoursesPage,
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

function CourseForm({ id, onDone }: { id?: string; onDone: () => void }) {
  const { t } = useApp();
  const data = useData();
  const existing = id ? data.courses.find((course) => course.id === id) : undefined;
  const [form, setForm] = useState({
    title: existing?.title ?? "",
    originalTitle: existing?.originalTitle ?? "",
    number: existing?.number ?? "",
    semester: existing?.semester ?? "",
    credits: existing?.credits ?? 0,
    type: existing?.type ?? "",
    instructor: existing?.instructor ?? "",
    prerequisites: existing?.prerequisites ?? "",
    description: existing?.description ?? "",
    status: (existing?.status ?? "not_started") as CourseStatus,
  });

  const save = () => {
    const title = form.title.trim();
    if (!title) return;
    const payload = { ...form, title };
    if (existing) {
      store.updateCourse(existing.id, payload);
    } else {
      store.createCourse({
        ...payload,
        programId: data.programs[0]?.id,
      });
    }
    onDone();
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>{t.title}</Label>
          <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
        </div>
        <div>
          <Label>{t.originalTitle}</Label>
          <Input
            value={form.originalTitle}
            onChange={(event) => setForm({ ...form, originalTitle: event.target.value })}
          />
        </div>
        <div>
          <Label>{t.courseNumber}</Label>
          <Input value={form.number} onChange={(event) => setForm({ ...form, number: event.target.value })} />
        </div>
        <div>
          <Label>{t.credits}</Label>
          <Input
            type="number"
            min="0"
            step="0.5"
            value={form.credits}
            onChange={(event) => setForm({ ...form, credits: Number(event.target.value) || 0 })}
          />
        </div>
        <div>
          <Label>{t.semester}</Label>
          <Input value={form.semester} onChange={(event) => setForm({ ...form, semester: event.target.value })} />
        </div>
        <div>
          <Label>{t.courseType}</Label>
          <Input value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} />
        </div>
        <div>
          <Label>{t.instructor}</Label>
          <Input
            value={form.instructor}
            onChange={(event) => setForm({ ...form, instructor: event.target.value })}
          />
        </div>
        <div>
          <Label>{t.prerequisites}</Label>
          <Input
            value={form.prerequisites}
            onChange={(event) => setForm({ ...form, prerequisites: event.target.value })}
          />
        </div>
      </div>
      <div>
        <Label>{t.description}</Label>
        <textarea
          className="w-full min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={form.description}
          onChange={(event) => setForm({ ...form, description: event.target.value })}
        />
      </div>
      <div>
        <Label>{t.status}</Label>
        <Select
          value={form.status}
          onValueChange={(value) => setForm({ ...form, status: value as CourseStatus })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="not_started">{t.notStarted}</SelectItem>
            <SelectItem value="in_progress">{t.inProgress}</SelectItem>
            <SelectItem value="completed">{t.completedStatus}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" onClick={onDone}>
          {t.cancel}
        </Button>
        <Button onClick={save} disabled={!form.title.trim()}>
          {t.save}
        </Button>
      </div>
    </div>
  );
}

function CoursesPage() {
  const { t, lang } = useApp();
  const data = useData();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | undefined>();
  const [semesterFilter, setSemesterFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const semesters = Array.from(
    new Set(data.courses.map((course) => course.semester).filter(Boolean)),
  ) as string[];
  const filtered = data.courses.filter(
    (course) =>
      (semesterFilter === "all" || course.semester === semesterFilter) &&
      (statusFilter === "all" || course.status === statusFilter),
  );

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title={t.courses}
        actions={
          <Dialog
            open={open}
            onOpenChange={(value) => {
              setOpen(value);
              if (!value) setEditId(undefined);
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={() => setEditId(undefined)}>
                <Plus className="h-4 w-4 me-1" />
                {t.createCourse}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90svh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editId ? t.edit : t.createCourse}</DialogTitle>
              </DialogHeader>
              <CourseForm
                id={editId}
                onDone={() => {
                  setOpen(false);
                  setEditId(undefined);
                }}
              />
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4 max-w-md">
        <Select value={semesterFilter} onValueChange={setSemesterFilter}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t.semester} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">— {t.semester} —</SelectItem>
            {semesters.map((semester) => (
              <SelectItem key={semester} value={semester}>
                {semester}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t.status} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">— {t.status} —</SelectItem>
            <SelectItem value="not_started">{t.notStarted}</SelectItem>
            <SelectItem value="in_progress">{t.inProgress}</SelectItem>
            <SelectItem value="completed">{t.completedStatus}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center text-muted-foreground">
          {t.empty}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((course) => (
            <article key={course.id} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-mono text-muted-foreground">{course.number || "—"}</div>
                  <Link
                    to="/app/courses/$courseId"
                    params={{ courseId: course.id }}
                    className="font-semibold hover:underline block truncate"
                  >
                    {course.title}
                  </Link>
                  {course.originalTitle && (
                    <div className="text-xs text-muted-foreground truncate">{course.originalTitle}</div>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={t.edit}
                    onClick={() => {
                      setEditId(course.id);
                      setOpen(true);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={t.delete}
                    onClick={() => {
                      if (confirm(`${t.confirm}?`)) store.deleteCourse(course.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                {course.semester && (
                  <span className="rounded bg-background px-2 py-0.5">{course.semester}</span>
                )}
                {course.credits ? (
                  <span className="rounded bg-background px-2 py-0.5">
                    {course.credits} {lang === "ru" ? "кред." : "credits"}
                  </span>
                ) : null}
                <span className="rounded bg-background px-2 py-0.5">
                  {courseStatusLabel(course.status, t)}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
