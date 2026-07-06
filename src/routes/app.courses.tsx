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

function CourseForm({ id, onDone }: { id?: string; onDone: () => void }) {
  const { t } = useApp();
  const data = useData();
  const existing = id ? data.courses.find((c) => c.id === id) : undefined;
  const [f, setF] = useState({
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
    if (existing) {
      store.updateCourse(existing.id, f);
    } else {
      store.createCourse({
        ...f,
        programId: data.programs[0]?.id,
      });
    }
    onDone();
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>{t.title}</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
        <div><Label>{t.originalTitle}</Label><Input value={f.originalTitle} onChange={(e) => setF({ ...f, originalTitle: e.target.value })} /></div>
        <div><Label>{t.courseNumber}</Label><Input value={f.number} onChange={(e) => setF({ ...f, number: e.target.value })} /></div>
        <div><Label>{t.credits}</Label><Input type="number" value={f.credits} onChange={(e) => setF({ ...f, credits: Number(e.target.value) || 0 })} /></div>
        <div><Label>{t.semester}</Label><Input value={f.semester} onChange={(e) => setF({ ...f, semester: e.target.value })} /></div>
        <div><Label>{t.courseType}</Label><Input value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} /></div>
        <div><Label>{t.instructor}</Label><Input value={f.instructor} onChange={(e) => setF({ ...f, instructor: e.target.value })} /></div>
        <div><Label>{t.prerequisites}</Label><Input value={f.prerequisites} onChange={(e) => setF({ ...f, prerequisites: e.target.value })} /></div>
      </div>
      <div>
        <Label>{t.description}</Label>
        <textarea
          className="w-full min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={f.description}
          onChange={(e) => setF({ ...f, description: e.target.value })}
        />
      </div>
      <div>
        <Label>{t.status}</Label>
        <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v as CourseStatus })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="not_started">{t.notStarted}</SelectItem>
            <SelectItem value="in_progress">{t.inProgress}</SelectItem>
            <SelectItem value="completed">{t.completedStatus}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" onClick={onDone}>{t.cancel}</Button>
        <Button onClick={save}>{t.save}</Button>
      </div>
    </div>
  );
}

function CoursesPage() {
  const { t } = useApp();
  const data = useData();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | undefined>();
  const [semFilter, setSemFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const semesters = Array.from(new Set(data.courses.map((c) => c.semester).filter(Boolean))) as string[];

  const filtered = data.courses.filter(
    (c) =>
      (semFilter === "all" || c.semester === semFilter) &&
      (statusFilter === "all" || c.status === statusFilter),
  );

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title={t.courses}
        actions={
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditId(undefined); }}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditId(undefined)}><Plus className="h-4 w-4 me-1" />{t.createCourse}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>{editId ? t.edit : t.createCourse}</DialogTitle></DialogHeader>
              <CourseForm id={editId} onDone={() => { setOpen(false); setEditId(undefined); }} />
            </DialogContent>
          </Dialog>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <Select value={semFilter} onValueChange={setSemFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder={t.semester} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">— {t.semester} —</SelectItem>
            {semesters.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder={t.status} /></SelectTrigger>
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
          {filtered.map((c) => (
            <div key={c.id} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="text-xs font-mono text-muted-foreground">{c.number}</div>
                  <Link
                    to="/app/courses/$courseId"
                    params={{ courseId: c.id }}
                    className="font-semibold hover:underline block truncate"
                  >
                    {c.title}
                  </Link>
                  {c.originalTitle && <div className="text-xs text-muted-foreground truncate">{c.originalTitle}</div>}
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => { setEditId(c.id); setOpen(true); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => { if (confirm(t.confirm + "?")) store.deleteCourse(c.id); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                {c.semester && <span className="rounded bg-background px-2 py-0.5">{c.semester}</span>}
                {c.credits ? <span className="rounded bg-background px-2 py-0.5">{c.credits} cr</span> : null}
                <span className="rounded bg-background px-2 py-0.5 uppercase">{c.status.replace("_", " ")}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
