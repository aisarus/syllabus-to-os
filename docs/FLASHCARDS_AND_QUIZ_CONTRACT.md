# Flashcards and generated quiz contract

## Flashcards are cards, not a spreadsheet

The primary flashcard experience must behave like a physical two-sided study card:

- one large card is shown at a time;
- the front contains the prompt or term;
- the back contains the answer or definition;
- clicking, tapping or pressing Space flips the card;
- the flip has a visible front/back transition;
- answer grading appears only after the back is revealed;
- Previous, Next, Shuffle, Again and Know are first-class controls;
- course and topic filters define the active deck;
- completing a deck produces a clear completion state.

Bulk text editing, CSV import, relinking and duplicate cleanup remain available in **Manage deck**, but management UI is secondary. The normal `/app/flashcards` route opens the two-sided study deck.

AI generation still returns an explicit `front` and `back` for every card. Both sides remain editable before saving, but the saved artifact is presented and studied as a card rather than as two permanently visible text fields.

## Golden generated quiz

The reference behavior is the supplied archaeology trainer. The implementation contract is based on its useful interaction model rather than on copying its visual design or embedded assets.

Each generated question must contain:

- one source-grounded prompt;
- exactly four options;
- exactly one correct option;
- three plausible, same-category distractors;
- a rationale aligned to every option;
- a concise explanation of the correct answer;
- a memory hint;
- source chunk references;
- optional prompt and option translations when the source and interface languages differ.

For Hebrew study material with Russian interface language:

- the primary question and options stay in Hebrew;
- Russian translations can be toggled without replacing the Hebrew;
- Hebrew academic terminology is preserved inside explanations where useful;
- mixed RTL/LTR content remains readable.

## Trainer behavior

- Questions and options may be shuffled without losing the mapping between an option, its translation, its rationale and its correctness.
- Selecting an option locks the question.
- The correct option becomes visibly correct.
- A selected wrong option becomes visibly wrong.
- The rationale for each option becomes visible after answering.
- The correct explanation and memory hint appear after answering.
- The next question is unavailable until the current question has been answered.
- The final score is saved as a quiz attempt.
- Retry reshuffles the attempt.

## AI trust rules

- The generator uses only selected source chunks.
- Unsupported questions are omitted rather than completed from model memory.
- Unknown source IDs are removed.
- A question without validated source support is surfaced through trust warnings.
- Distractor rationales may not introduce facts absent from the selected sources.
- Four empty, duplicate or joke options do not constitute a valid question.

## Backward compatibility

Existing quizzes with a plain `explanation` remain runnable. Rich feedback is stored in a readable, version-marked Markdown block inside the existing explanation field so no destructive local-data migration is required. The trainer parses this block; the advanced editor can still display and edit it as text.
