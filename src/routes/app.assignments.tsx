import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useApp } from "@/lib/app-context";
import { useData, store, type AssignmentStatus, type Priority } from "@/lib/store";
import { Plus, Trash2, Pencil } from "lucide-react";
import { AIAssignmentBreakdownButton } from "@/components/ai-side-actions";

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
      <div>
        <Label htmlFor="assignment-title">{t.title}</Label>
        <Input
          id="assignment-title"
          dir="auto"
          value={f.title}
          onChange={(e) => setF({ ...f, title: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="assignment-course">{t.linkedCourse}</Label>
          <Select value={f.courseId} onValueChange={(v) => setF({ ...f, courseId: v })}>
            <SelectTrigger id="assignment-course">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">— {t.none} —</SelectItem>
              {data.courses.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="assignment-due-date">{t.dueDate}</Label>
          <Input
            id="assignment-due-date"
            type="date"
            value={f.dueDate}
            onChange={(e) => setF({ ...f, dueDate: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="assignment-status">{t.status}</Label>
          <Select
            value={f.status}
            onValueChange={(v) => setF({ ...f, status: v as AssignmentStatus })}
          >
            <SelectTrigger id="assignment-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="not_started">{t.notStarted}</SelectItem>
              <SelectItem value="in_progress">{t.inProgress}</SelectItem>
              <SelectItem value="submitted">{t.submitted}</SelectItem>
              <SelectItem value="graded">{t.graded}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="assignment-priority">{t.priority}</Label>
          <Select value={f.priority} onValueChange={(v) => setF({ ...f, priority: v as Priority })}>
            <SelectTrigger id="assignment-priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">{t.low}</SelectItem>
              <SelectItem value="medium">{t.medium}</SelectItem>
              <SelectItem value="high">{t.high}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="assignment-grade">{t.grade}</Label>
          <Input
            id="assignment-grade"
            dir="auto"
            value={f.grade}
            onChange={(e) => setF({ ...f, grade: e.target.value })}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="assignment-notes">{t.notes}</Label>
        <textarea
          id="assignment-notes"
          dir="auto"
          className="w-full min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={f.notes}
          onChange={(e) => setF({ ...f, notes: e.target.value })}
        />
      </div>
      <div className="flex justify-end gap-2">
        {id && <AIAssignmentBreakdownButton assignmentId={id} />}
        <div className="flex-1" />
        <Button variant="ghost" onClick={onDone}>
          {t.cancel}
        </Button>
        <Button onClick={save}>{t.save}</Button>
      </div>
    </div>
  );
}

function AssignmentsPage() {
  const { t, lang } = useApp();
  const data = useData();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | undefined>();
  const sorted = [...data.assignments].sort((a, b) =>
    (a.dueDate || "").localeCompare(b.dueDate || ""),
  );
  const isRu = lang === "ru";

  const badge = (p: Priority) =>
    ({
      low: "bg-blue-500/15 text-blue-300",
      medium: "bg-yellow-500/15 text-yellow-300",
      high: "bg-red-500/15 text-red-300",
    })[p];

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title={t.assignments}
        actions={
          <Dialog
            open={open}
            onOpenChange={(o) => {
              setOpen(o);
              if (!o) setEditId(undefined);
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={() => setEditId(undefined)}>
                <Plus className="h-4 w-4 me-1" />
                {t.createAssignment}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editId ? t.edit : t.createAssignment}</DialogTitle>
              </DialogHeader>
              <AssignmentForm
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
      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center text-muted-foreground">
          {t.empty}
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((a) => {
            const course = data.courses.find((c) => c.id === a.courseId);
            return (
              <div
                key={a.id}
                className="rounded-lg border border-border bg-surface p-3 flex items-center gap-3"
              >
                <span className={`px-2 py-0.5 rounded text-[10px] uppercase ${badge(a.priority)}`}>
                  {t[a.priority]}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate" dir="auto">
                    {a.title}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {course?.title || t.none} {a.dueDate && `· ${a.dueDate}`} ·{" "}
                    {a.status.replace("_", " ")}
                    {a.grade && ` · ${t.grade}: ${a.grade}`}
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={
                    isRu ? `Редактировать задание «${a.title}»` : `Edit assignment “${a.title}”`
                  }
                  onClick={() => {
                    setEditId(a.id);
                    setOpen(true);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={
                    isRu ? `Удалить задание «${a.title}»` : `Delete assignment “${a.title}”`
                  }
                  onClick={() => {
                    if (confirm(t.confirm + "?")) store.deleteAssignment(a.id);
                  }}
                >
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
