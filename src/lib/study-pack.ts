import type { StudyPackDraft } from "./ai";

export type StudyPackLocale = "ru" | "en";

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function collectStudyPackSourceIds(draft: StudyPackDraft): string[] {
  return unique([
    ...draft.orientationSourceChunkIds,
    ...draft.steps.flatMap((step) => step.sourceChunkIds),
    ...draft.note.sourceChunkIds,
    ...draft.keyTerms.flatMap((term) => term.sourceChunkIds),
    ...draft.cards.flatMap((card) => card.sourceChunkIds),
    ...draft.questions.flatMap((question) => question.sourceChunkIds),
    ...draft.unclearAreas.flatMap((area) => area.sourceChunkIds),
  ]);
}

export function validateStudyPackDraft(draft: StudyPackDraft): string[] {
  const failures: string[] = [];
  if (!draft.title.trim()) failures.push("title");
  if (!draft.orientation.trim()) failures.push("orientation");
  if (!draft.note.title.trim() || !draft.note.content.trim()) failures.push("note");
  if (draft.steps.length === 0) failures.push("steps");
  if (draft.cards.length === 0) failures.push("cards");
  if (draft.questions.length === 0) failures.push("questions");

  draft.steps.forEach((step, index) => {
    if (!step.title.trim() || !step.purpose.trim() || step.durationMinutes < 1) {
      failures.push(`step:${index}`);
    }
  });
  draft.cards.forEach((card, index) => {
    if (!card.front.trim() || !card.back.trim()) failures.push(`card:${index}`);
  });
  draft.questions.forEach((question, index) => {
    const options = question.options.map((option) => option.trim());
    if (
      !question.prompt.trim() ||
      options.length !== 4 ||
      options.some((option) => !option) ||
      new Set(options).size !== 4 ||
      question.correctIndex < 0 ||
      question.correctIndex > 3
    ) {
      failures.push(`question:${index}`);
    }
  });

  return unique(failures);
}

export function buildStudyPackNoteContent(draft: StudyPackDraft, locale: StudyPackLocale): string {
  const ru = locale === "ru";
  const sections: string[] = [];

  sections.push(`# ${draft.title.trim()}`);
  sections.push(`## ${ru ? "Ориентация" : "Orientation"}\n\n${draft.orientation.trim()}`);

  if (draft.steps.length > 0) {
    sections.push(
      `## ${ru ? "Маршрут занятия" : "Study route"}\n\n${draft.steps
        .map(
          (step, index) =>
            `${index + 1}. **${step.title.trim()}** — ${step.durationMinutes} ${ru ? "мин" : "min"}\n   ${step.purpose.trim()}`,
        )
        .join("\n")}`,
    );
  }

  sections.push(`## ${draft.note.title.trim()}\n\n${draft.note.content.trim()}`);

  if (draft.keyTerms.length > 0) {
    sections.push(
      `## ${ru ? "Ключевые термины" : "Key terms"}\n\n${draft.keyTerms
        .map((term) => `- **${term.term.trim()}** — ${term.explanation.trim()}`)
        .join("\n")}`,
    );
  }

  if (draft.unclearAreas.length > 0) {
    sections.push(
      `## ${ru ? "Что требует проверки" : "What still needs review"}\n\n${draft.unclearAreas
        .map((area) => `- ${area.description.trim()}`)
        .join("\n")}`,
    );
  }

  sections.push(
    `> ${
      ru
        ? `Плановая длительность: ${draft.estimatedMinutes} мин. Завершение маршрута не означает автоматического освоения темы.`
        : `Planned duration: ${draft.estimatedMinutes} min. Completing the route does not automatically prove mastery.`
    }`,
  );

  return sections.filter(Boolean).join("\n\n");
}

export function studyPackCopyText(draft: StudyPackDraft, locale: StudyPackLocale): string {
  const ru = locale === "ru";
  return [
    buildStudyPackNoteContent(draft, locale),
    `## ${ru ? "Карточки" : "Flashcards"}`,
    draft.cards.map((card) => `- ${card.front}\n  ${card.back}`).join("\n"),
    `## ${ru ? "Диагностические вопросы" : "Diagnostic questions"}`,
    draft.questions
      .map(
        (question, index) =>
          `${index + 1}. ${question.prompt}\n${question.options
            .map((option, optionIndex) => `   ${optionIndex + 1}) ${option}`)
            .join(
              "\n",
            )}\n   ${ru ? "Ответ" : "Answer"}: ${question.options[question.correctIndex] ?? ""}\n   ${question.explanation}`,
      )
      .join("\n\n"),
  ].join("\n\n");
}
