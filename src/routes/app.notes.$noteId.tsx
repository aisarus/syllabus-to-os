import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/lib/app-context";
import { store, useData } from "@/lib/store";

export const Route = createFileRoute("/app/notes/$noteId")({
  component: NoteDetailPage,
});

function NoteDetailPage() {
  const { noteId } = Route.useParams();
  const { t, lang } = useApp();
  const data = useData();
  const navigate = useNavigate();
  const isRu = lang === "ru";
  const note = data.notes.find((item) => item.id === noteId);

  if (!note) {
    return (
      <div className="mx-auto max-w-4xl">
        <Button variant="ghost" onClick={() => navigate({ to: "/app/notes" })}>
          <ArrowLeft className="h-4 w-4 me-1" />
          {t.back}
        </Button>
        <div className="mt-4 rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
          {isRu ? "Конспект удалён или не найден" : "The note was deleted or could not be found"}
        </div>
      </div>
    );
  }

  const material = note.materialId
    ? data.materials.find((item) => item.id === note.materialId)
    : undefined;
  const topics = data.topics.filter(
    (topic) => !note.courseId || topic.courseId === note.courseId,
  );

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => navigate({ to: "/app/notes" })}>
          <ArrowLeft className="h-4 w-4 me-1" />
          {t.notes}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => {
            const confirmed = confirm(
              isRu ? "Удалить этот конспект?" : "Delete this note?",
            );
            if (!confirmed) return;
            store.deleteNote(note.id);
            navigate({ to: "/app/notes" });
          }}
        >
          <Trash2 className="h-4 w-4 me-1" />
          {t.delete}
        </Button>
      </div>

      <section className="rounded-lg border border-border bg-surface p-4 md:p-6">
        <Input
          value={note.title}
          aria-label={t.title}
          onChange={(event) => store.updateNote(note.id, { title: event.target.value })}
          className="h-auto border-transparent bg-transparent p-0 font-serif text-2xl font-semibold hover:border-input focus:border-input md:text-3xl"
        />

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
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
            disabled={!note.courseId}
          >
            <SelectTrigger>
              <SelectValue placeholder={t.linkedTopic} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">— {t.none} —</SelectItem>
              {topics.map((topic) => (
                <SelectItem key={topic.id} value={topic.id}>
                  {topic.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Input
          className="mt-3"
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

        {material && (
          <Link
            to="/app/materials/$materialId"
            params={{ materialId: material.id }}
            className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {t.source}: {material.title}
          </Link>
        )}

        <Textarea
          dir="auto"
          className="mt-5 min-h-[440px] resize-y font-mono text-sm leading-6"
          value={note.content}
          aria-label={t.content}
          onChange={(event) => store.updateNote(note.id, { content: event.target.value })}
        />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span>
            {note.sourceChunkIds?.length ?? 0} {isRu ? "ссылок на фрагменты" : "source chunk references"}
          </span>
          <span>
            {isRu ? "Обновлено" : "Updated"}: {new Date(note.updatedAt).toLocaleString(isRu ? "ru-RU" : "en-GB")}
          </span>
        </div>
      </section>
    </div>
  );
}
