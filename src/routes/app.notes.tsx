import { createFileRoute } from "@tanstack/react-router";
import { NotesLibrary } from "@/components/notes-library";

export const Route = createFileRoute("/app/notes")({
  component: NotesPage,
});

function NotesPage() {
  return <NotesLibrary />;
}
