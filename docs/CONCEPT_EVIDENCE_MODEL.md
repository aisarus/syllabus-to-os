# Lamdan Concept Evidence Model v1

## Purpose

The Concept Evidence Model represents what the student has encountered, recalled, explained and applied without turning activity into fake mastery.

## Storage and migration

- Core user data remains in the existing `lamdan.data.v1` store and is not rewritten.
- Concept data uses `lamdan.concept-evidence.v1`.
- Immutable per-question attempt snapshots use `lamdan.quiz-attempt-details.v1` and reference the core aggregate attempt id.
- Missing concept or attempt-detail data migrates to an empty v1 layer.
- Import normalizes malformed records and never mutates the core workspace.
- Course-level concept/evidence JSON can be exported and merged back explicitly.
- Workspace backup v2 includes core data, visual sources, concept evidence and immutable question-level attempt details with separate checksums and rollback.

## Concept relationships

Each concept may link to:

- one course;
- one optional topic;
- approved material chunks;
- flashcards used for recall;
- quiz questions used for assessment evidence;
- aliases and a user-editable description.

Dangling chunk, card, question, topic and course references are reconciled against the current core store. Evidence tied to a deleted or unlinked flashcard, quiz attempt or quiz question is removed rather than left dangling.

## Reviewed concept extraction

Concept extraction is a proposal-and-review workflow, not an automatic mutation:

- AI can inspect at most eight explicitly selected approved chunks.
- The prompt forbids model-memory facts and requires exact allowed `sourceChunkIds` for every candidate.
- Candidates without a validated source id are removed before they reach the browser.
- Existing concept titles and aliases are supplied as a do-not-duplicate list.
- Saved Study Pack notes can be scanned locally for their `Key terms` / `Ключевые термины` section.
- Study Pack candidates inherit only still-valid note-level source chunk ids, so the UI explicitly warns that every relationship needs review.
- Candidate title, description, aliases and source links remain editable before acceptance.
- Duplicate titles or aliases are blocked from acceptance.
- Nothing enters `lamdan.concept-evidence.v1` until the user selects and confirms a candidate.
- Accepting a candidate creates a source-linked concept only. It creates no learning evidence, no success event and no knowledge-state increase.

The AI result is intentionally ephemeral. Rejected or abandoned candidates are not persisted.

## Evidence kinds

- `recognition` — recorded from a linked per-question multiple-choice answer;
- `recall` — recorded from a linked flashcard review;
- `explanation` — explicit user-recorded check;
- `application` — explicit user-recorded check;
- `assessment` — historical aggregate quiz-attempt context.

## Per-question quiz evidence

Every new attempt made through the main evidence-aware quiz runner stores an immutable snapshot for each question:

- question id and prompt at attempt time;
- selected index and selected option text;
- correct index and correct option text;
- correctness;
- source chunk ids copied from the question;
- attempt mode and timestamp.

Editing the quiz later does not rewrite the attempt snapshot. A correct linked answer creates objective `recognition/success` evidence; an incorrect linked answer creates `recognition/failure` with mistake kind `unclassified`. Lamdan does not infer confusion or carelessness automatically.

Historical attempts without per-question snapshots remain `assessment/mixed` context. They do not count as success or failure for a specific concept because assigning a whole-quiz score to one concept would invent evidence. When a detailed snapshot exists, the old aggregate context is removed for that attempt.

The legacy Practice/Exam launch controls inside the editor are hidden and blocked. The primary quiz route is the only supported attempt runner, ensuring that new user attempts retain question-level history.

Manual explanation and application checks are secondary evidence. They remain visible and useful, but manual events alone cannot create `strong` state.

## Knowledge states

- `unseen` — no linked source or evidence;
- `covered` — linked source/practice exists, but no scored evidence;
- `fragile` — some success or failure exists, but evidence is limited, old, too manual or one-dimensional;
- `weak` — repeated failures or a recent failure dominate;
- `strong` — at least four successes, including at least two non-manual successes, across at least two distinct days and at least two evidence kinds, with no dominant recent failure and a successful event within 21 days.

One correct answer, one flashcard rating, repeated manual self-rating, file views, note creation, elapsed time and aggregate quiz score cannot create `strong` state.

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

The application never infers a specific mistake category from an aggregate quiz score or a wrong multiple-choice answer.

## Inspectability

Every event shows:

- evidence kind;
- outcome;
- source label;
- timestamp;
- optional score/note;
- editable mistake category for failures.

Every event is removable. Removing evidence recalculates the concept state immediately.

## Current boundaries

- Reviewed extraction proposes atomic concepts from selected chunks or saved Study Pack key terms; it does not infer a full ontology or hidden relationships.
- Old aggregate attempts remain neutral because historical per-question choices do not exist.
- Open-answer and oral-response capture are not implemented yet.
- No score prediction or exam-readiness percentage is produced.
