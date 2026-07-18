import { createFileRoute } from "@tanstack/react-router";
import { NotesLibrary } from "@/components/notes-library";
import { StudyOutputLayout } from "@/components/study-output-layout";

export const Route = createFileRoute("/app/notes")({
  component: NotesPage,
});

function NotesPage() {
  return (
    <StudyOutputLayout current="notes">
      <NotesLibrary />
    </StudyOutputLayout>
  );
}
