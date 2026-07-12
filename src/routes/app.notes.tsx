import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search, Pin, Trash2 } from "lucide-react";
import { RoomHeading, BrassButton } from "@/components/study-room-ui";
import { useData } from "@/lib/store";

export const Route = createFileRoute("/app/notes")({
  component: NotesPage,
});

const fallbackNotes = [
  {
    id: "class",
    title: "Social structure",
    date: "12 July",
    category: "Class notes",
    body: "A social structure is the arrangement of social relationships and institutions that together create the patterns of behavior and interaction in a society.",
  },
  {
    id: "government",
    title: "Government essay",
    date: "11 July",
    category: "To review",
    body: "Outline the transition from the provisional institutions to the first elected Knesset. Compare the legal and political continuity between the periods.",
  },
  {
    id: "hebrew",
    title: "Academic Hebrew",
    date: "10 July",
    category: "Ideas",
    body: "Build a compact review page for connectors, passive structures and the vocabulary that repeats in academic reading passages.",
  },
];

function NotesPage() {
  const data = useData();
  const notes = useMemo(() => {
    if (!data.notes.length) return fallbackNotes;
    return data.notes.slice(0, 8).map((note) => ({
      id: note.id,
      title: note.title,
      date: new Date(note.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long" }),
      category: note.tags[0] || "Class notes",
      body: note.content || "This page is waiting for your next thought.",
    }));
  }, [data.notes]);
  const [activeId, setActiveId] = useState(notes[0]?.id || "");
  const active = notes.find((note) => note.id === activeId) || notes[0];

  return (
    <div className="room-page notes-room">
      <RoomHeading
        eyebrow="Your commonplace book"
        title="Notes"
        subtitle={`${notes.length} notes gathered across your courses`}
        actions={<BrassButton><Plus size={15} /> New note</BrassButton>}
      />

      <div className="notebook-scene">
        <div className="notebook-props" aria-hidden="true" />
        <div className="open-notebook">
          <div className="notebook-page notebook-page--index">
            <div className="notebook-page__header">
              <span>INDEX</span>
              <label><Search size={13} /><input aria-label="Search notes" placeholder="Search" /></label>
            </div>
            <ul className="note-index">
              {notes.map((note, index) => (
                <li key={note.id}>
                  <button type="button" className={active?.id === note.id ? "is-active" : ""} onClick={() => setActiveId(note.id)}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{note.title}</strong>
                    <small>{note.category}</small>
                  </button>
                </li>
              ))}
            </ul>
            <blockquote>“Writing is thinking made visible.”</blockquote>
          </div>

          <div className="notebook-binding" aria-hidden="true">
            {Array.from({ length: 10 }).map((_, index) => <span key={index} />)}
          </div>

          <article className="notebook-page notebook-page--writing">
            <header>
              <div>
                <small>{active?.category || "Class notes"}</small>
                <h2>{active?.title || "Untitled note"}</h2>
              </div>
              <time>{active?.date}</time>
            </header>
            <div className="notebook-lines">
              <p contentEditable suppressContentEditableWarning>{active?.body}</p>
              <h3>Key idea</h3>
              <p contentEditable suppressContentEditableWarning>
                Institutions do not exist separately from people: they shape repeated actions, while repeated actions keep institutions alive.
              </p>
              <div className="hand-drawn-diagram" aria-label="Simple social structure diagram">
                <span>individual</span><i /><span>group</span><i /><span>institution</span>
              </div>
            </div>
            <aside className="sticky-thought">Any system becomes easier to understand when its relationships are visible.</aside>
            <footer>
              <button type="button"><Pin size={14} /> Pin</button>
              <button type="button"><Trash2 size={14} /> Delete</button>
              <span>Saved locally</span>
            </footer>
          </article>
        </div>
      </div>
    </div>
  );
}
