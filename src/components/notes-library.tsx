import { Link } from "@tanstack/react-router";
import {
  Copy,
  FileText,
  GitMerge,
  Plus,
  Search,
  Square,
  CheckSquare2,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AIGenerateButton } from "@/components/ai-generate-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/lib/app-context";
import { store, useData, type Note } from "@/lib/store";

export function NotesLibrary() {
  const { lang } = useApp();
  const isRu = lang === "ru";
  const data = useData();
  const [query, setQuery] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const [materialFilter, setMaterialFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mergeOpen, setMergeOpen] = useState(false);

  const tags = useMemo(
    () => Array.from(new Set(data.notes.flatMap((note) => note.tags))).sort(),
    [data.notes],
  );
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return data.notes
      .filter((note) => courseFilter === "all" || note.courseId === courseFilter)
      .filter((note) => materialFilter === "all" || note.materialId === materialFilter)
      .filter((note) => tagFilter === "all" || note.tags.includes(tagFilter))
      .filter(
        (note) =>
          !normalized ||
          note.title.toLowerCase().includes(normalized) ||
          note.content.toLowerCase().includes(normalized) ||
          note.tags.some((tag) => tag.toLowerCase().includes(normalized)),
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [data.notes, query, courseFilter, materialFilter, tagFilter]);

  const selectedNotes = selectedIds
    .map((id) => data.notes.find((note) => note.id === id))
    .filter((note): note is Note => Boolean(note));

  const createNote = () => {
    const created = store.createNote({
      title: isRu ? "Без названия" : "Untitled",
      content: "",
      tags: [],
    });
    window.location.assign(`/app/notes/${created.id}`);
  };

  const duplicate = (note: Note) => {
    const created = store.createNote({
      title: `${note.title} — ${isRu ? "копия" : "copy"}`,
      content: note.content,
      tags: Array.from(new Set([...note.tags, "duplicate"])),
      courseId: note.courseId,
      topicId: note.topicId,
      materialId: note.materialId,
      sourceChunkIds: note.sourceChunkIds,
    });
    toast.success(isRu ? "Копия создана" : "Copy created");
    window.location.assign(`/app/notes/${created.id}`);
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold">{isRu ? "Конспекты" : "Notes"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isRu
              ? "Постоянная библиотека редактируемых конспектов со связями на курсы и источники."
              : "A persistent library of editable notes linked to courses and sources."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AIGenerateButton kind="note" />
          <Button onClick={createNote}>
            <Plus className="h-4 w-4 me-1" />
            {isRu ? "Новый конспект" : "New note"}
          </Button>
        </div>
      </div>

      <section className="mt-5 rounded-xl border border-border bg-surface p-4">
        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_200px_200px_180px]">
          <div className="relative">
            <Search className="absolute start-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="ps-8"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={isRu ? "Поиск по тексту, названию и тегам" : "Search title, text, and tags"}
            />
          </div>
          <Select value={courseFilter} onValueChange={setCourseFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isRu ? "Все курсы" : "All courses"}</SelectItem>
              {data.courses.map((course) => (
                <SelectItem key={course.id} value={course.id}>{course.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={materialFilter} onValueChange={setMaterialFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isRu ? "Все источники" : "All sources"}</SelectItem>
              {data.materials.map((material) => (
                <SelectItem key={material.id} value={material.id}>{material.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={tagFilter} onValueChange={setTagFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isRu ? "Все теги" : "All tags"}</SelectItem>
              {tags.map((tag) => <SelectItem key={tag} value={tag}>{tag}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{filtered.length} {isRu ? "конспектов" : "notes"}</span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={selectedNotes.length < 2}
              onClick={() => setMergeOpen(true)}
            >
              <GitMerge className="h-3.5 w-3.5 me-1" />
              {isRu ? "Объединить выбранные" : "Merge selected"} ({selectedNotes.length})
            </Button>
            {selectedIds.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>
                {isRu ? "Снять выбор" : "Clear selection"}
              </Button>
            )}
          </div>
        </div>
      </section>

      {filtered.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-border p-12 text-center">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
          <strong className="mt-3 block">{isRu ? "Ничего не найдено" : "Nothing found"}</strong>
          <p className="mt-1 text-sm text-muted-foreground">
            {isRu ? "Измени фильтры или создай первый конспект." : "Change filters or create the first note."}
          </p>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((note) => {
            const selected = selectedIds.includes(note.id);
            const course = data.courses.find((item) => item.id === note.courseId);
            const material = data.materials.find((item) => item.id === note.materialId);
            return (
              <article key={note.id} className={`rounded-xl border bg-surface p-4 ${selected ? "border-primary/60" : "border-border"}`}>
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    aria-label={selected ? (isRu ? "Снять выбор" : "Deselect") : isRu ? "Выбрать" : "Select"}
                    className="mt-0.5 text-primary"
                    onClick={() =>
                      setSelectedIds((current) =>
                        current.includes(note.id)
                          ? current.filter((id) => id !== note.id)
                          : [...current, note.id],
                      )
                    }
                  >
                    {selected ? <CheckSquare2 className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                  </button>
                  <Link to="/app/notes/$noteId" params={{ noteId: note.id }} className="min-w-0 flex-1">
                    <h2 className="truncate font-serif text-lg font-semibold hover:text-primary">
                      {note.title || (isRu ? "Без названия" : "Untitled")}
                    </h2>
                    <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                      {note.content || (isRu ? "Пустой конспект" : "Empty note")}
                    </p>
                  </Link>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
                  {course && <span className="rounded border border-border px-2 py-1">{course.title}</span>}
                  {material && <span className="rounded border border-border px-2 py-1">{material.title}</span>}
                  {note.tags.slice(0, 4).map((tag) => (
                    <span key={tag} className="rounded bg-primary/10 px-2 py-1 text-primary">#{tag}</span>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
                  <time className="text-[10px] text-muted-foreground">
                    {new Date(note.updatedAt).toLocaleString(isRu ? "ru-RU" : "en-GB")}
                  </time>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" aria-label={isRu ? "Дублировать" : "Duplicate"} onClick={() => duplicate(note)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={isRu ? "Удалить" : "Delete"}
                      onClick={() => {
                        const confirmed = confirm(isRu ? "Удалить этот конспект?" : "Delete this note?");
                        if (!confirmed) return;
                        store.deleteNote(note.id);
                        setSelectedIds((current) => current.filter((id) => id !== note.id));
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <MergeNotesDialog
        open={mergeOpen}
        onOpenChange={setMergeOpen}
        notes={selectedNotes}
        onMerged={() => setSelectedIds([])}
      />
    </div>
  );
}

function MergeNotesDialog({
  open,
  onOpenChange,
  notes,
  onMerged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notes: Note[];
  onMerged: () => void;
}) {
  const { lang } = useApp();
  const isRu = lang === "ru";
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const preview = useMemo(
    () =>
      notes
        .map((note) => `## ${note.title || (isRu ? "Без названия" : "Untitled")}\n\n${note.content}`)
        .join("\n\n---\n\n"),
    [notes, isRu],
  );

  const resolvedTitle = title || notes.map((note) => note.title).filter(Boolean).join(" + ");
  const resolvedContent = content || preview;

  const merge = () => {
    if (notes.length < 2 || !resolvedTitle.trim()) return;
    const courseIds = Array.from(new Set(notes.map((note) => note.courseId).filter(Boolean)));
    const topicIds = Array.from(new Set(notes.map((note) => note.topicId).filter(Boolean)));
    const materialIds = Array.from(new Set(notes.map((note) => note.materialId).filter(Boolean)));
    const created = store.createNote({
      title: resolvedTitle.trim(),
      content: resolvedContent,
      tags: Array.from(new Set([...notes.flatMap((note) => note.tags), "merged"])),
      courseId: courseIds.length === 1 ? courseIds[0] : undefined,
      topicId: topicIds.length === 1 ? topicIds[0] : undefined,
      materialId: materialIds.length === 1 ? materialIds[0] : undefined,
      sourceChunkIds: Array.from(new Set(notes.flatMap((note) => note.sourceChunkIds ?? []))),
    });
    toast.success(
      isRu
        ? "Новый объединённый конспект создан. Оригиналы сохранены."
        : "A merged note was created. Originals were preserved.",
    );
    onOpenChange(false);
    onMerged();
    window.location.assign(`/app/notes/${created.id}`);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setTitle("");
          setContent("");
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isRu ? "Предпросмотр объединения" : "Merge preview"}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          {isRu
            ? "Будет создан новый конспект. Оригиналы не удаляются и не изменяются."
            : "A new note will be created. Original notes are not changed or deleted."}
        </p>
        <div className="space-y-3">
          <div>
            <Label>{isRu ? "Название" : "Title"}</Label>
            <Input value={resolvedTitle} onChange={(event) => setTitle(event.target.value)} />
          </div>
          <div>
            <Label>{isRu ? "Объединённый текст" : "Merged content"}</Label>
            <Textarea
              dir="auto"
              className="min-h-[360px] resize-y font-mono text-sm"
              value={resolvedContent}
              onChange={(event) => setContent(event.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {isRu ? "Отмена" : "Cancel"}
          </Button>
          <Button onClick={merge} disabled={notes.length < 2 || !resolvedTitle.trim()}>
            <GitMerge className="h-4 w-4 me-1" />
            {isRu ? "Создать объединённый" : "Create merged note"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
