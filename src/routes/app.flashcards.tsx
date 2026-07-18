import { createFileRoute } from "@tanstack/react-router";
import { FlashcardExperience } from "@/components/flashcard-experience";
import { StudyOutputLayout } from "@/components/study-output-layout";

export const Route = createFileRoute("/app/flashcards")({
  component: FlashcardsPage,
});

function FlashcardsPage() {
  return (
    <StudyOutputLayout current="flashcards">
      <FlashcardExperience />
    </StudyOutputLayout>
  );
}
