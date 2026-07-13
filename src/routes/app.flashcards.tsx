import { createFileRoute } from "@tanstack/react-router";
import { FlashcardExperience } from "@/components/flashcard-experience";

export const Route = createFileRoute("/app/flashcards")({
  component: FlashcardsPage,
});

function FlashcardsPage() {
  return <FlashcardExperience />;
}
