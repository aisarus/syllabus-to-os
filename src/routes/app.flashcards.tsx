import { createFileRoute } from "@tanstack/react-router";
import { FlashcardStudio } from "@/components/flashcard-studio";

export const Route = createFileRoute("/app/flashcards")({
  component: FlashcardsPage,
});

function FlashcardsPage() {
  return <FlashcardStudio />;
}
