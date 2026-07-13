import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
import { useData, store, type CalendarEventType } from "@/lib/store";
import { Plus, Trash2, Pencil } from "lucide-react";

export const Route = createFileRoute("/app/calendar")({
  component: CalendarPage,
});

const TYPES: CalendarEventType[] = [
  "class",
  "assignment",
  "exam",
  "study_session",
  "personal",
  "other",
];

function typeLabel(t: ReturnType<typeof useApp>["t"], v: CalendarEventType) {
  return v === "class"
    ? t.class_
    : v === "assignment"
      ? t.assignments
      : v === "exam"
        ? t.exam
        : v === "study_session"
          ? t.studySession
          : v === "personal"
            ? t.personal
            : t.other;
}

function typeColor(v: CalendarEventType) {
  switch (v) {
    case "class":
      return "bg-blue-500/15 text-blue-300";
    case "assignment":
      return "bg-yellow-500/15 text-yellow-300";
    case "exam":
      return "bg-red-500/15 text-red-300";
    case "study_session":
      return "bg-emerald-500/15 text-emerald-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function EventForm({ id, onDone }: { id?: string; onDone: () => void }) {
  const { t } = useApp();
  const data = useData();
  const ex = id ? data.calendarEvents.find((e) => e.id === id) : undefined;
  const [f, setF] = useState({
    title: ex?.title ?? "",
    type: (ex?.type ?? "class") as CalendarEventType,
    date: ex?.date ?? new Date().toISOString().slice(0, 10),
    startTime: ex?.startTime ?? "",
    endTime: ex?.endTime ?? "",
    courseId: ex?.courseId ?? "_none",
    notes: ex?.notes ?? "",
  });
  const save = () => {
    if (!f.title.trim() || !f.date) return;
    const payload = {
      title: f.title,
      type: f.type,
      date: f.date,
      startTime: f.startTime || undefined,
      endTime: f.endTime || undefined,
      courseId: f.courseId === "_none" ? undefined : f.courseId,
      notes: f.notes || undefined,
    };
    if (ex) store.updateEvent(ex.id, payload);
    else store.createEvent(payload);
    onDone();
  };
  return (
    <div className="space-y-3">
      <div>
        <Label>{t.title}</Label>
        <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>{t.eventType}</Label>
          <Select
            value={f.type}
            onValueChange={(v) => setF({ ...f, type: v as CalendarEventType })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPES.map((v) => (
                <SelectItem key={v} value={v}>
                  {typeLabel(t, v)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>{t.date}</Label>
          <Input
            type="date"
            value={f.date}
            onChange={(e) => setF({ ...f, date: e.target.value })}
          />
        </div>
        <div>
          <Label>{t.startTime}</Label>
          <Input
            type="time"
            value={f.startTime}
            onChange={(e) => setF({ ...f, startTime: e.target.value })}
          />
        </div>
        <div>
          <Label>{t.endTime}</Label>
          <Input
            type="time"
            value={f.endTime}
            onChange={(e) => setF({ ...f, endTime: e.target.value })}
          />
        </div>
      </div>
      <div>
        <Label>{t.linkedCourse}</Label>
        <Select value={f.courseId} onValueChange={(v) => setF({ ...f, courseId: v })}>
          <SelectTrigger>
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
        <Label>{t.notes}</Label>
        <textarea
          className="w-full min-h-16 rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={f.notes}
          onChange={(e) => setF({ ...f, notes: e.target.value })}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          {t.cancel}
        </Button>
        <Button onClick={save}>{t.save}</Button>
      </div>
    </div>
  );
}

function CalendarPage() {
  const { t } = useApp();
  const data = useData();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | undefined>();

  // Combine calendar events with assignment deadlines (virtual)
  const combined = useMemo(() => {
    const items: Array<{
      key: string;
      title: string;
      type: CalendarEventType;
      date: string;
      startTime?: string;
      courseId?: string;
      notes?: string;
      real?: string; // event id if real
    }> = data.calendarEvents.map((e) => ({
      key: e.id,
      title: e.title,
      type: e.type,
      date: e.date,
      startTime: e.startTime,
      courseId: e.courseId,
      notes: e.notes,
      real: e.id,
    }));
    for (const a of data.assignments) {
      if (a.dueDate && a.status !== "graded" && a.status !== "submitted") {
        items.push({
          key: `a_${a.id}`,
          title: a.title,
          type: "assignment",
          date: a.dueDate,
          courseId: a.courseId,
          notes: `${t.assignments} · ${a.priority}`,
        });
      }
    }
    return items.sort((a, b) =>
      (a.date + (a.startTime || "")).localeCompare(b.date + (b.startTime || "")),
    );
  }, [data.calendarEvents, data.assignments, t.assignments]);

  const today = new Date().toISOString().slice(0, 10);
  const grouped = useMemo(() => {
    const map = new Map<string, typeof combined>();
    for (const item of combined) {
      const arr = map.get(item.date) ?? [];
      arr.push(item);
      map.set(item.date, arr);
    }
    return [...map.entries()].filter(([d]) => d >= today).slice(0, 30);
  }, [combined, today]);

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title={t.calendar}
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
                {t.createEvent}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editId ? t.edit : t.createEvent}</DialogTitle>
              </DialogHeader>
              <EventForm
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
      {grouped.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center text-muted-foreground">
          {t.calendarEmpty}
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([date, items]) => (
            <div key={date}>
              <div className="text-xs text-muted-foreground mb-2 flex items-center gap-2">
                <span>{date}</span>
                {date === today && (
                  <span className="rounded bg-primary/20 text-primary px-1.5 py-0.5">
                    {t.today}
                  </span>
                )}
              </div>
              <div className="space-y-1.5">
                {items.map((e) => {
                  const course = data.courses.find((c) => c.id === e.courseId);
                  return (
                    <div
                      key={e.key}
                      className="rounded-lg border border-border bg-surface p-3 flex items-center gap-3"
                    >
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] uppercase ${typeColor(e.type)}`}
                      >
                        {typeLabel(t, e.type)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{e.title}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {e.startTime && <span className="me-2">{e.startTime}</span>}
                          {course?.title || ""}
                          {e.notes && ` · ${e.notes}`}
                        </div>
                      </div>
                      {e.real && (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setEditId(e.real);
                              setOpen(true);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              if (confirm(t.confirm + "?")) store.deleteEvent(e.real!);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
