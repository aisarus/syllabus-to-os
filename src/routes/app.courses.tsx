import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Search, SlidersHorizontal } from "lucide-react";
import { CourseBook, WoodenShelf, RoomHeading, BrassButton, EmptyInk } from "@/components/study-room-ui";
import { EmptyBookSlot } from "@/components/lamdan/empty-book-slot";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/lib/app-context";
import { useData, store, type Course } from "@/lib/store";
import { courseTone } from "@/lib/course-tone";

export const Route = createFileRoute("/app/courses")({
  component: CoursesPage,
});

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function CoursesPage() {
  const { t } = useApp();
  const data = useData();
  const [open, setOpen] = useState(false);
  const courses = data.courses;
  const isEmpty = courses.length === 0;
  const rows = chunk(courses, 4);

  return (
    <div className="room-page courses-room">
      <RoomHeading
        eyebrow="Your library"
        title={t.courses}
        subtitle={isEmpty ? t.emptyShelfHint : `${courses.length}`}
        actions={
          <BrassButton onClick={() => setOpen(true)}>
            <Plus size={15} /> {t.createCourse}
          </BrassButton>
        }
      />

      <div className="shelf-toolbar">
        <label><Search size={15} /><input placeholder={t.search} aria-label={t.search} /></label>
        <button type="button"><SlidersHorizontal size={14} /> {t.semester}</button>
      </div>

      <div className="course-library">
        {isEmpty ? (
          <WoodenShelf>
            <div className="course-library__row">
              <EmptyInk>
                <strong style={{ display: "block", fontFamily: "var(--font-display)", fontSize: 18 }}>
                  {t.emptyShelfTitle}
                </strong>
                <span>{t.emptyShelfHint}</span>
              </EmptyInk>
              <EmptyBookSlot label={t.addFirstCourse} onClick={() => setOpen(true)} />
            </div>
          </WoodenShelf>
        ) : (
          rows.map((row, rowIndex) => {
            const isLast = rowIndex === rows.length - 1;
            return (
              <WoodenShelf key={rowIndex}>
                <div className="course-library__row">
                  {row.map((course, i) => (
                    <CourseBook
                      key={course.id}
                      code={course.number || `#${rowIndex * 4 + i + 1}`}
                      title={course.title}
                      progress={null}
                      tone={courseTone(course.id)}
                      to={`/app/courses/${course.id}`}
                    />
                  ))}
                  {isLast && row.length < 4 && (
                    <EmptyBookSlot label={t.createCourse} onClick={() => setOpen(true)} />
                  )}
                </div>
              </WoodenShelf>
            );
          })
        )}
      </div>

      <aside className="library-marginalia">
        <span>LIBRARY NOTE</span>
        <p>A course becomes easier to return to when every note, card and deadline has a visible home.</p>
      </aside>

      <CreateCourseDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

function CreateCourseDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useApp();
  const [title, setTitle] = useState("");
  const [number, setNumber] = useState("");
  const [semester, setSemester] = useState("");
  const [credits, setCredits] = useState("");
  const [instructor, setInstructor] = useState("");

  const reset = () => {
    setTitle(""); setNumber(""); setSemester(""); setCredits(""); setInstructor("");
  };

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const patch: Omit<Course, "id" | "createdAt" | "order"> = {
      title: trimmed,
      number: number.trim() || undefined,
      semester: semester.trim() || undefined,
      credits: credits.trim() ? Number(credits) : undefined,
      instructor: instructor.trim() || undefined,
      status: "not_started",
    };
    store.createCourse(patch);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}
    >
      <DialogContent>
        <DialogHeader><DialogTitle>{t.createCourse}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>{t.title} *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t.courseNumber}</Label>
              <Input value={number} onChange={(e) => setNumber(e.target.value)} />
            </div>
            <div>
              <Label>{t.semester}</Label>
              <Input value={semester} onChange={(e) => setSemester(e.target.value)} />
            </div>
            <div>
              <Label>{t.credits}</Label>
              <Input type="number" inputMode="numeric" value={credits} onChange={(e) => setCredits(e.target.value)} />
            </div>
            <div>
              <Label>{t.instructor}</Label>
              <Input value={instructor} onChange={(e) => setInstructor(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { onOpenChange(false); reset(); }}>{t.cancel}</Button>
          <Button onClick={submit} disabled={!title.trim()}>{t.save}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
