import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useApp } from "@/lib/app-context";
import { useData, store } from "@/lib/store";
import { Plus, Trash2, Play } from "lucide-react";

export const Route = createFileRoute("/app/flashcards")({
  component: FlashcardsPage,
});

function CardForm({ onDone }: { onDone: () => void }) {
  const { t } = useApp();
  const data = useData();
  const [f, setF] = useState({ front: "", back: "", courseId: "_none", materialId: "_none" });
  return (
    <div className="space-y-3">
      <div><Label>{t.front}</Label><Input value={f.front} onChange={(e) => setF({ ...f, front: e.target.value })} /></div>
      <div><Label>{t.cardBack}</Label><Input value={f.back} onChange={(e) => setF({ ...f, back: e.target.value })} /></div>
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
      <div>
        <Label>{t.linkedMaterial}</Label>
        <Select value={f.materialId} onValueChange={(v) => setF({ ...f, materialId: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">— {t.none} —</SelectItem>
            {data.materials.map((m) => <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>{t.cancel}</Button>
        <Button
          onClick={() => {
            if (!f.front || !f.back) return;
            store.createCard({
              front: f.front, back: f.back,
              courseId: f.courseId === "_none" ? undefined : f.courseId,
              materialId: f.materialId === "_none" ? undefined : f.materialId,
            });
            onDone();
          }}
        >{t.save}</Button>
      </div>
    </div>
  );
}

function ReviewMode({ onDone }: { onDone: () => void }) {
  const { t } = useApp();
  const data = useData();
  const due = useMemo(() => data.flashcards.filter((c) => c.dueAt <= Date.now()), [data.flashcards]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = due[idx];

  if (!card) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground mb-4">{t.noDueCards}</p>
        <Button onClick={onDone}>{t.close}</Button>
      </div>
    );
  }

  const rate = (q: "again" | "good" | "easy") => {
    store.reviewCard(card.id, q);
    setFlipped(false);
    setIdx(idx + 1);
  };

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground">{idx + 1} / {due.length}</div>
      <div
        className="min-h-[200px] rounded-lg border border-border bg-background p-8 flex items-center justify-center text-center cursor-pointer"
        onClick={() => setFlipped((v) => !v)}
      >
        <div className="text-lg">{flipped ? card.back : card.front}</div>
      </div>
      {flipped ? (
        <div className="grid grid-cols-3 gap-2">
          <Button variant="destructive" onClick={() => rate("again")}>{t.again}</Button>
          <Button variant="outline" onClick={() => rate("good")}>{t.good}</Button>
          <Button onClick={() => rate("easy")}>{t.easy}</Button>
        </div>
      ) : (
        <Button className="w-full" onClick={() => setFlipped(true)}>Show answer</Button>
      )}
    </div>
  );
}

function FlashcardsPage() {
  const { t } = useApp();
  const data = useData();
  const [open, setOpen] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [matFilter, setMatFilter] = useState("all");
  const dueCount = data.flashcards.filter((c) => c.dueAt <= Date.now()).length;
  const filtered = data.flashcards.filter((c) => matFilter === "all" || c.materialId === matFilter);

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title={t.flashcards}
        actions={
          <>
            <Button variant="outline" disabled title={t.notConnected}>{t.generateCards}</Button>
            <Button variant="outline" onClick={() => setReviewing(true)} disabled={dueCount === 0}>
              <Play className="h-4 w-4 me-1" />{t.reviewMode} ({dueCount})
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 me-1" />{t.createCard}</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{t.createCard}</DialogTitle></DialogHeader>
                <CardForm onDone={() => setOpen(false)} />
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <div className="mb-4">
        <Select value={matFilter} onValueChange={setMatFilter}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder={t.linkedMaterial} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">— {t.linkedMaterial} —</SelectItem>
            {data.materials.map((m) => <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Dialog open={reviewing} onOpenChange={setReviewing}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t.reviewMode}</DialogTitle></DialogHeader>
          <ReviewMode onDone={() => setReviewing(false)} />
        </DialogContent>
      </Dialog>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center text-muted-foreground">
          {t.empty}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((c) => (
            <div key={c.id} className="rounded-lg border border-border bg-surface p-4">
              <div className="text-xs text-muted-foreground uppercase mb-1">{c.status}</div>
              <Input value={c.front} onChange={(e) => store.updateCard(c.id, { front: e.target.value })} />
              <Input className="mt-2" value={c.back} onChange={(e) => store.updateCard(c.id, { back: e.target.value })} />
              <div className="flex justify-between items-center mt-2">
                <span className="text-[11px] text-muted-foreground">
                  Due: {new Date(c.dueAt).toLocaleDateString()}
                </span>
                <Button size="icon" variant="ghost" onClick={() => store.deleteCard(c.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
