import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useApp } from "@/lib/app-context";
import { useData, store, type AssignmentStatus, type Priority } from "@/lib/store";
import { Plus, Trash2, Pencil } from "lucide-react";

export const Route = createFileRoute("/app/assignments")({
  component: AssignmentsPage,
});

function AssignmentForm({ id, onDone }: { id?: string; onDone: () => void }) {
  const { t } = useApp();
  const data = useData();
  const ex = id ? data.assignments.find((a) => a.id === id) : undefined;
  const [f, setF] = useState({
    title: ex?.title ?? "",
    courseId: ex?.courseId ?? "_none",
    dueDate: ex?.dueDate ?? "",
    status: (ex?.status ?? "not_started") as AssignmentStatus,
    priority: (ex?.priority ?? "medium") as Priority,
    notes: ex?.notes ?? "",
    grade: ex?.grade ?? "",
  });
  const save = () => {
    const payload = { ...f, courseId: f.courseId === "_none" ? undefined : f.courseId };
    if (ex) store.updateAssignment(ex.id, payload);
    else store.createAssignment(payload);
    onDone();
  };
  return (
    <div className="space-y-3">
      <div><Label>{t.title}</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>{t.linkedCourse}</Label>
          <Select value={f.courseId} onValueChange={(v) => setF({ ...f, courseId: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">— {t.none} —</SelectItem>
              {data.courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label>{t.dueDate}</Label><Input type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} /></div>
        <div>
          <Label>{t.status}</Label>
          <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v as AssignmentStatus })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="not_started">{t.notStarted}</SelectItem>
              <SelectItem value="in_progress">{t.inProgress}</SelectItem>
              <SelectItem value="submitted">{t.submitted}</SelectItem>
              <SelectItem value="graded">{t.graded}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>{t.priority}</Label>
          <Select value={f.priority} onValueChange={(v) => setF({ ...f, priority: v as Priority })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">{t.low}</SelectItem>
              <SelectItem value="medium">{t.medium}</SelectItem>
              <SelectItem value="high">{t.high}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>{t.grade}</Label><Input value={f.grade} onChange={(e) => setF({ ...f, grade: e.target.value })} /></div>
      </div>
      <div>
        <Label>{t.notes}</Label>
        <textarea
          className="w-full min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={f.notes}
          onChange={(e) => setF({ ...f, notes: e.target.value })}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>{t.cancel}</Button>
        <Button onClick={save}>{t.save}</Button>
      </div>
    </div>
  );
}

function AssignmentsPage() {
  const { t } = useApp();
  const data = useData();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | undefined>();
  const sorted = [...data.assignments].sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));

  const badge = (p: Priority) =>
    ({ low: "bg-blue-500/15 text-blue-300", medium: "bg-yellow-500/15 text-yellow-300", high: "bg-red-500/15 text-red-300" }[p]);

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title={t.assignments}
        actions={
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditId(undefined); }}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditId(undefined)}><Plus className="h-4 w-4 me-1" />{t.createAssignment}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editId ? t.edit : t.createAssignment}</DialogTitle></DialogHeader>
              <AssignmentForm id={editId} onDone={() => { setOpen(false); setEditId(undefined); }} />
            </DialogContent>
          </Dialog>
        }
      />
      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center text-muted-foreground">{t.empty}</div>
      ) : (
        <div className="space-y-2">
          {sorted.map((a) => {
            const course = data.courses.find((c) => c.id === a.courseId);
            return (
              <div key={a.id} className="rounded-lg border border-border bg-surface p-3 flex items-center gap-3">
                <span className={`px-2 py-0.5 rounded text-[10px] uppercase ${badge(a.priority)}`}>{t[a.priority]}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{a.title}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {course?.title || t.none} {a.dueDate && `· ${a.dueDate}`} · {a.status.replace("_", " ")}
                    {a.grade && ` · ${t.grade}: ${a.grade}`}
                  </div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => { setEditId(a.id); setOpen(true); }}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => { if (confirm(t.confirm + "?")) store.deleteAssignment(a.id); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
