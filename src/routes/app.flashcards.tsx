import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useApp } from "@/lib/app-context";
import { useData, store, type CardStatus } from "@/lib/store";
import { Plus, Trash2, Play } from "lucide-react";
import { AIGenerateButton } from "@/components/ai-generate-dialog";

export const Route = createFileRoute("/app/flashcards")({
  component: FlashcardsPage,
});

function CardForm({ onDone }: { onDone: () => void }) {
  const { t } = useApp();
  const data = useData();
  const [form, setForm] = useState({ front: "", back: "", courseId: "_none", materialId: "_none" });

  return (
    <div className="space-y-3">
      <div>
        <Label>{t.front}</Label>
        <Input value={form.front} onChange={(event) => setForm({ ...form, front: event.target.value })} />
      </div>
      <div>
        <Label>{t.cardBack}</Label>
        <Input value={form.back} onChange={(event) => setForm({ ...form, back: event.target.value })} />
      </div>
      <div>
        <Label>{t.linkedCourse}</Label>
        <Select value={form.courseId} onValueChange={(value) => setForm({ ...form, courseId: value })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">— {t.none} —</SelectItem>
            {data.courses.map((course) => (
              <SelectItem key={course.id} value={course.id}>
                {course.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>{t.linkedMaterial}</Label>
        <Select
          value={form.materialId}
          onValueChange={(value) => setForm({ ...form, materialId: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">— {t.none} —</SelectItem>
            {data.materials.map((material) => (
              <SelectItem key={material.id} value={material.id}>
                {material.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          {t.cancel}
        </Button>
        <Button
          onClick={() => {
            if (!form.front.trim() || !form.back.trim()) return;
            store.createCard({
              front: form.front.trim(),
              back: form.back.trim(),
              courseId: form.courseId === "_none" ? undefined : form.courseId,
              materialId: form.materialId === "_none" ? undefined : form.materialId,
            });
            onDone();
          }}
        >
          {t.save}
        </Button>
      </div>
    </div>
  );
}

function ReviewMode({ onDone }: { onDone: () => void }) {
  const { t, lang } = useApp();
  const data = useData();
  const due = useMemo(
    () => data.flashcards.filter((card) => card.dueAt <= Date.now()),
    [data.flashcards],
  );
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = due[index];

  if (!card) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground mb-4">{t.noDueCards}</p>
        <Button onClick={onDone}>{t.close}</Button>
      </div>
    );
  }

  const rate = (quality: "again" | "good" | "easy") => {
    store.reviewCard(card.id, quality);
    setFlipped(false);
    setIndex(index + 1);
  };

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground">
        {index + 1} / {due.length}
      </div>
      <button
        type="button"
        className="min-h-[200px] w-full rounded-lg border border-border bg-background p-8 flex items-center justify-center text-center cursor-pointer"
        onClick={() => setFlipped((value) => !value)}
      >
        <span className="text-lg">{flipped ? card.back : card.front}</span>
      </button>
      {flipped ? (
        <div className="grid grid-cols-3 gap-2">
          <Button variant="destructive" onClick={() => rate("again")}>
            {t.again}
          </Button>
          <Button variant="outline" onClick={() => rate("good")}>
            {t.good}
          </Button>
          <Button onClick={() => rate("easy")}>{t.easy}</Button>
        </div>
      ) : (
        <Button className="w-full" onClick={() => setFlipped(true)}>
          {lang === "ru" ? "Показать ответ" : "Show answer"}
        </Button>
      )}
    </div>
  );
}

function statusLabel(status: CardStatus, t: ReturnType<typeof useApp>["t"]): string {
  switch (status) {
    case "new":
      return t.new_;
    case "learning":
      return t.learning;
    case "mastered":
      return t.mastered;
  }
}

function FlashcardsPage() {
  const { t, lang } = useApp();
  const data = useData();
  const [open, setOpen] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [materialFilter, setMaterialFilter] = useState("all");
  const dueCount = data.flashcards.filter((card) => card.dueAt <= Date.now()).length;
  const filtered = data.flashcards.filter(
    (card) => materialFilter === "all" || card.materialId === materialFilter,
  );

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title={t.flashcards}
        actions={
          <>
            <AIGenerateButton kind="flashcards" />
            <Button variant="outline" onClick={() => setReviewing(true)} disabled={dueCount === 0}>
              <Play className="h-4 w-4 me-1" />
              {t.reviewMode} ({dueCount})
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 me-1" />
                  {t.createCard}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t.createCard}</DialogTitle>
                </DialogHeader>
                <CardForm onDone={() => setOpen(false)} />
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <div className="mb-4">
        <Select value={materialFilter} onValueChange={setMaterialFilter}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder={t.linkedMaterial} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">— {t.linkedMaterial} —</SelectItem>
            {data.materials.map((material) => (
              <SelectItem key={material.id} value={material.id}>
                {material.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Dialog open={reviewing} onOpenChange={setReviewing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.reviewMode}</DialogTitle>
          </DialogHeader>
          <ReviewMode onDone={() => setReviewing(false)} />
        </DialogContent>
      </Dialog>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center text-muted-foreground">
          {t.empty}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((card) => (
            <div key={card.id} className="rounded-lg border border-border bg-surface p-4">
              <div className="text-xs text-muted-foreground uppercase mb-1">
                {statusLabel(card.status, t)}
              </div>
              <Input
                value={card.front}
                aria-label={t.front}
                onChange={(event) => store.updateCard(card.id, { front: event.target.value })}
              />
              <Input
                className="mt-2"
                value={card.back}
                aria-label={t.cardBack}
                onChange={(event) => store.updateCard(card.id, { back: event.target.value })}
              />
              <div className="flex justify-between items-center mt-2 gap-3">
                <span className="text-[11px] text-muted-foreground">
                  {lang === "ru" ? "Повторить" : "Due"}: {new Date(card.dueAt).toLocaleDateString(lang === "ru" ? "ru-RU" : "en-GB")}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={t.delete}
                  onClick={() => store.deleteCard(card.id)}
                >
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
