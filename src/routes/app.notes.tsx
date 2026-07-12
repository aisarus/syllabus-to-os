import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApp } from "@/lib/app-context";
import { useData, store } from "@/lib/store";
import { Plus, Trash2, Search, ExternalLink } from "lucide-react";
import { AIGenerateButton } from "@/components/ai-generate-dialog";

export const Route = createFileRoute("/app/notes")({
  component: NotesPage,
});

function NotesPage() {
  const { t, lang } = useApp();
  const data = useData();
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const untitled = lang === "ru" ? "Без названия" : "Untitled";
  const markdownPlaceholder =
    lang === "ru" ? "Текст конспекта в Markdown…" : "Note content in Markdown…";

  const note = selected ? data.notes.find((item) => item.id === selected) : null;
  const material = note?.materialId
    ? data.materials.find((item) => item.id === note.materialId)
    : null;

  const filtered = data.notes.filter((item) => {
    const query = search.toLowerCase();
    return (
      !query ||
      item.title.toLowerCase().includes(query) ||
      item.content.toLowerCase().includes(query) ||
      item.tags.some((tag) => tag.toLowerCase().includes(query))
    );
  });

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title={t.notes}
        actions={
          <>
            <AIGenerateButton kind="note" />
            <Button
              onClick={() => {
                const created = store.createNote({ title: untitled, content: "", tags: [] });
                setSelected(created.id);
              }}
            >
              <Plus className="h-4 w-4 me-1" />
              {t.createNote}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-[280px_minmax(0,1fr)] gap-4">
        <aside className="space-y-2 min-w-0">
          <div className="relative">
            <Search className="absolute start-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="ps-8"
              placeholder={t.search}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          {filtered.length === 0 && (
            <div className="text-xs text-muted-foreground">{t.empty}</div>
          )}
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelected(item.id)}
              className={`w-full text-start rounded-md border border-border p-2 hover:bg-accent ${
                selected === item.id ? "bg-accent" : "bg-surface"
              }`}
            >
              <div className="text-sm font-medium truncate">{item.title || untitled}</div>
              <div className="text-[11px] text-muted-foreground truncate">
                {item.content.slice(0, 60) || "—"}
              </div>
            </button>
          ))}
        </aside>

        <section className="rounded-lg border border-border bg-surface p-4 min-h-[400px] min-w-0">
          {!note ? (
            <div className="text-sm text-muted-foreground">{t.empty}</div>
          ) : (
            <div className="space-y-3">
              <Input
                value={note.title}
                aria-label={t.title}
                onChange={(event) => store.updateNote(note.id, { title: event.target.value })}
                className="text-lg font-semibold"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Select
                  value={note.courseId ?? "_none"}
                  onValueChange={(value) =>
                    store.updateNote(note.id, {
                      courseId: value === "_none" ? undefined : value,
                      topicId: undefined,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t.linkedCourse} />
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
                <Select
                  value={note.topicId ?? "_none"}
                  onValueChange={(value) =>
                    store.updateNote(note.id, {
                      topicId: value === "_none" ? undefined : value,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t.linkedTopic} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— {t.none} —</SelectItem>
                    {data.topics
                      .filter((topic) => !note.courseId || topic.courseId === note.courseId)
                      .map((topic) => (
                        <SelectItem key={topic.id} value={topic.id}>
                          {topic.title}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <Select
                value={note.materialId ?? "_none"}
                onValueChange={(value) =>
                  store.updateNote(note.id, {
                    materialId: value === "_none" ? undefined : value,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t.linkedMaterial} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— {t.none} —</SelectItem>
                  {data.materials.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {material && (
                <Link
                  to="/app/materials/$materialId"
                  params={{ materialId: material.id }}
                  className="text-xs text-primary inline-flex items-center gap-1 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  {t.source}: {material.title}
                </Link>
              )}
              <Input
                placeholder={t.tags}
                value={note.tags.join(", ")}
                onChange={(event) =>
                  store.updateNote(note.id, {
                    tags: event.target.value
                      .split(",")
                      .map((tag) => tag.trim())
                      .filter(Boolean),
                  })
                }
              />
              <textarea
                className="w-full min-h-[300px] rounded-md border border-input bg-background p-3 text-sm font-mono"
                value={note.content}
                aria-label={t.content}
                onChange={(event) => store.updateNote(note.id, { content: event.target.value })}
                placeholder={markdownPlaceholder}
              />
              <div className="flex justify-end">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (confirm(`${t.confirm}?`)) {
                      store.deleteNote(note.id);
                      setSelected(null);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 me-1" />
                  {t.delete}
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
