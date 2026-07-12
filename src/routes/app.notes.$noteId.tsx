import { createFileRoute } from "@tanstack/react-router";
import { NoteEditorWorkspace } from "@/components/note-editor-workspace";

export const Route = createFileRoute("/app/notes/$noteId")({
  component: NoteDetailPage,
});

function NoteDetailPage() {
  const { noteId } = Route.useParams();
  return <NoteEditorWorkspace noteId={noteId} />;
}
