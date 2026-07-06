import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApp } from "@/lib/app-context";
import { useData, store } from "@/lib/store";
import { Plus, Trash2, Search, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/app/notes")({
  component: NotesPage,
});

function NotesPage() {
  const { t } = useApp();
  const data = useData();
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const note = selected ? data.notes.find((n) => n.id === selected) : null;
  const material = note?.materialId ? data.materials.find((m) => m.id === note.materialId) : null;

  const filtered = data.notes.filter((n) => {
    const q = search.toLowerCase();
    return (
      !q ||
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      n.tags.some((tg) => tg.toLowerCase().includes(q))
    );
  });

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title={t.notes}
        actions={
          <>
            <Button variant="outline" disabled title={t.notConnected}>{t.generateNotes}</Button>
            <Button
              onClick={() => {
                const n = store.createNote({ title: "Untitled", content: "", tags: [] });
                setSelected(n.id);
              }}
            >
              <Plus className="h-4 w-4 me-1" />{t.createNote}
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute start-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="ps-8" placeholder={t.search} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {filtered.length === 0 && <div className="text-xs text-muted-foreground">{t.empty}</div>}
          {filtered.map((n) => (
            <button
              key={n.id}
              onClick={() => setSelected(n.id)}
              className={`w-full text-start rounded-md border border-border p-2 hover:bg-accent ${selected === n.id ? "bg-accent" : "bg-surface"}`}
            >
              <div className="text-sm font-medium truncate">{n.title || "Untitled"}</div>
              <div className="text-[11px] text-muted-foreground truncate">{n.content.slice(0, 60)}</div>
            </button>
          ))}
        </div>
        <div className="rounded-lg border border-border bg-surface p-4 min-h-[400px]">
          {!note ? (
            <div className="text-sm text-muted-foreground">{t.empty}</div>
          ) : (
            <div className="space-y-3">
              <Input
                value={note.title}
                onChange={(e) => store.updateNote(note.id, { title: e.target.value })}
                className="text-lg font-semibold"
              />
              <div className="grid grid-cols-2 gap-2">
                <Select value={note.courseId ?? "_none"} onValueChange={(v) => store.updateNote(note.id, { courseId: v === "_none" ? undefined : v, topicId: undefined })}>
                  <SelectTrigger><SelectValue placeholder={t.linkedCourse} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— {t.none} —</SelectItem>
                    {data.courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select
                  value={note.topicId ?? "_none"}
                  onValueChange={(v) => store.updateNote(note.id, { topicId: v === "_none" ? undefined : v })}
                >
                  <SelectTrigger><SelectValue placeholder={t.linkedTopic} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— {t.none} —</SelectItem>
                    {data.topics.filter((tp) => !note.courseId || tp.courseId === note.courseId).map((tp) => (
                      <SelectItem key={tp.id} value={tp.id}>{tp.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Select
                value={note.materialId ?? "_none"}
                onValueChange={(v) => store.updateNote(note.id, { materialId: v === "_none" ? undefined : v })}
              >
                <SelectTrigger><SelectValue placeholder={t.linkedMaterial} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— {t.none} —</SelectItem>
                  {data.materials.map((m) => <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>)}
                </SelectContent>
              </Select>
              {material && (
                <Link
                  to="/app/materials/$materialId"
                  params={{ materialId: material.id }}
                  className="text-xs text-primary inline-flex items-center gap-1 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />{t.source}: {material.title}
                </Link>
              )}
              <Input
                placeholder={t.tags}
                value={note.tags.join(", ")}
                onChange={(e) => store.updateNote(note.id, { tags: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })}
              />
              <textarea
                className="w-full min-h-[300px] rounded-md border border-input bg-background p-3 text-sm font-mono"
                value={note.content}
                onChange={(e) => store.updateNote(note.id, { content: e.target.value })}
                placeholder="Markdown..."
              />
              <div className="flex justify-end">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (confirm(t.confirm + "?")) {
                      store.deleteNote(note.id);
                      setSelected(null);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 me-1" />{t.delete}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
