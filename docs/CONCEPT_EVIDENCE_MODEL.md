# Lamdan Concept Evidence Model v1

## Purpose

The Concept Evidence Model represents what the student has encountered, recalled, explained and applied without turning activity into fake mastery.

## Storage and migration

- Core user data remains in the existing `lamdan.data.v1` store and is not rewritten.
- Concept data uses `lamdan.concept-evidence.v1`.
- Missing concept data migrates to an empty v1 concept layer.
- Import normalizes malformed records and never mutates the core workspace.
- Course-level concept/evidence JSON can be exported and merged back explicitly.
- Full visual ZIP integration remains a follow-up; the concept workspace exposes its own visible export so the limitation is not hidden.

## Concept relationships

Each concept may link to:

- one course;
- one optional topic;
- approved material chunks;
- flashcards used for recall;
- quiz questions used for assessment context;
- aliases and a user-editable description.

Dangling chunk, card, question, topic and course references are reconciled against the current core store. Evidence tied to a deleted flashcard is removed rather than left dangling.

## Evidence kinds

- `recognition` — reserved for future per-question answer evidence;
- `recall` — recorded from a linked flashcard review;
- `explanation` — explicit user-recorded check;
- `application` — explicit user-recorded check;
- `assessment` — aggregate quiz-attempt context.

Aggregate quiz attempts are stored as `mixed` context. They do not count as success or failure for a specific concept because the existing QuizAttempt record contains no per-question answers. This avoids inventing concept-level correctness from a whole-quiz score.

## Knowledge states

- `unseen` — no linked source or evidence;
- `covered` — linked source/practice exists, but no scored evidence;
- `fragile` — some success or failure exists, but evidence is limited, old or one-dimensional;
- `weak` — repeated failures or a recent failure dominate;
- `strong` — at least four successes, at least two distinct days, at least two evidence kinds, no dominant recent failure and a successful event within 21 days.

One correct answer, one flashcard rating, file views, note creation, elapsed time and aggregate quiz score cannot create `strong` state.

## Forgetting risk

Forgetting risk is based only on time since the latest successful scored evidence:

- low: up to 7 days;
- medium: 8–21 days;
- high: more than 21 days;
- none: no successful evidence exists.

This is a scheduling signal, not a mastery percentage.

## Mistake taxonomy

Failure events can be classified and edited as:

- retrieval failure;
- concept confusion;
- application failure;
- careless error;
- unclassified.

The application never infers a specific mistake category from an aggregate quiz score.

## Inspectability

Every event shows:

- evidence kind;
- outcome;
- source label;
- timestamp;
- optional score/note;
- editable mistake category for failures.

Every event is removable. Removing evidence recalculates the concept state immediately.

## V1 boundaries

- Concepts are created and linked manually; AI concept extraction review is not implemented yet.
- Quiz attempts are neutral context until per-question answers are persisted.
- Open-answer and oral-response capture are not implemented yet.
- Concept data has a dedicated JSON export; full visual ZIP integration is pending.
- No score prediction or exam-readiness percentage is produced.
