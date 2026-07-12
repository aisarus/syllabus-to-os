import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search, Pin, Trash2 } from "lucide-react";
import { RoomHeading, BrassButton } from "@/components/study-room-ui";
import { useData } from "@/lib/store";
import { useApp } from "@/lib/app-context";

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
  const { t, lang } = useApp();
  const data = useData();
  const locale = lang === "ru" ? "ru-RU" : "en-GB";
  const notes = useMemo(() => {
    if (!data.notes.length) return fallbackNotes;
    return data.notes.slice(0, 8).map((note) => ({
      id: note.id,
      title: note.title,
      date: new Date(note.updatedAt).toLocaleDateString(locale, { day: "numeric", month: "long" }),
      category: note.tags[0] || t.classNotesCategory,
      body: note.content || "",
    }));
  }, [data.notes, locale, t.classNotesCategory]);
  const [activeId, setActiveId] = useState(notes[0]?.id || "");
  const active = notes.find((note) => note.id === activeId) || notes[0];

  return (
    <div className="room-page notes-room">
      <RoomHeading
        eyebrow={t.commonplaceEyebrow}
        title={t.notes}
        subtitle={`${notes.length} ${t.notesGatheredSuffix}`}
        actions={
          <BrassButton>
            <Plus size={15} /> {t.newNote}
          </BrassButton>
        }
      />

      <div className="notebook-scene">
        <div className="notebook-props" aria-hidden="true" />
        <div className="open-notebook">
          <div className="notebook-page notebook-page--index">
            <div className="notebook-page__header">
              <span>{t.notesIndexLabel}</span>
              <label>
                <Search size={13} />
                <input aria-label={t.searchNotesAria} placeholder={t.searchNotesPlaceholder} />
              </label>
            </div>
            <ul className="note-index">
              {notes.map((note, index) => (
                <li key={note.id}>
                  <button
                    type="button"
                    className={active?.id === note.id ? "is-active" : ""}
                    onClick={() => setActiveId(note.id)}
                  >
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{note.title}</strong>
                    <small>{note.category}</small>
                  </button>
                </li>
              ))}
            </ul>
            <blockquote>{`“${t.notebookQuote}”`}</blockquote>
          </div>

          <div className="notebook-binding" aria-hidden="true">
            {Array.from({ length: 10 }).map((_, index) => (
              <span key={index} />
            ))}
          </div>

          <article className="notebook-page notebook-page--writing">
            <header>
              <div>
                <small>{active?.category || t.classNotesCategory}</small>
                <h2>{active?.title || t.untitledNote}</h2>
              </div>
              <time>{active?.date}</time>
            </header>
            <div className="notebook-lines">
              <p contentEditable suppressContentEditableWarning>
                {active?.body}
              </p>
              <h3>{t.keyIdeaHeading}</h3>
              <p contentEditable suppressContentEditableWarning>
                Institutions do not exist separately from people: they shape repeated actions, while
                repeated actions keep institutions alive.
              </p>
              <div className="hand-drawn-diagram" aria-label={t.diagramAria}>
                <span>individual</span>
                <i />
                <span>group</span>
                <i />
                <span>institution</span>
              </div>
            </div>
            <aside className="sticky-thought">{t.stickyThought}</aside>
            <footer>
              <button type="button">
                <Pin size={14} /> {t.pin}
              </button>
              <button type="button">
                <Trash2 size={14} /> {t.delete}
              </button>
              <span>{t.savedLocally}</span>
            </footer>
          </article>
        </div>
      </div>
    </div>
  );
}
