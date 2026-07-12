# Lamdan — P0 Implementation Tasks

This file turns the P0 section of `ROADMAP.md` into an executable sequence of atomic, testable work.

The goal is not to build every planned feature. The goal is to make one real Israeli university course work end to end:

```text
Import syllabus
→ create course structure
→ upload materials
→ inspect extracted content
→ generate note, flashcards and quiz
→ review and save outputs
→ return later with all source relationships intact
```

## Task status legend

- `[ ]` not started
- `[~]` in progress
- `[x]` complete
- `[!]` blocked

## Priority legend

- `P0` blocks the first useful product milestone
- `P1` useful immediately after the core loop works
- `P2` deferred

## Size legend

- `S` small and isolated
- `M` several files or one complete interaction
- `L` major vertical slice
- `XL` must be split before implementation

## Global definition of done

Every task must satisfy all applicable requirements:

- Works with real store data; no fallback sample content.
- Data survives page reload.
- Empty, loading, partial, error and success states are honest.
- User-generated and imported content is not silently translated or overwritten.
- AI output remains an editable draft until explicit save.
- Material, course, topic and chunk relationships are preserved.
- RU and EN application chrome remain functional.
- Hebrew and mixed RTL/LTR content remain readable.
- Desktop and mobile layouts remain usable.
- No new tracker, timer, streak or vanity-progress UI is introduced.
- No illustrated-room or fixed-canvas visual system is reintroduced.
- `npm run check` passes, or any pre-existing failure is explicitly documented.
- Modified files and manual verification steps are reported.

## Execution rules

1. Work in the listed order unless a dependency is explicitly satisfied another way.
2. One task should create one independently testable behavior.
3. Do not combine architecture rewrites with feature delivery.
4. Preserve the current localStorage schema unless a task explicitly adds a versioned migration.
5. Before changing a route, inspect its current implementation and reuse working store and AI code.
6. Keep `DESIGN_SYSTEM.md`, `ROADMAP.md` and `AGENTS.md` authoritative.
7. Update this file after completing a task.

---

# Milestone A — Stable product foundation

## P0-001 — Add continuous integration

- **Status:** [ ]
- **Priority:** P0
- **Size:** S
- **Depends on:** none
- **Likely files:** `.github/workflows/ci.yml`, `package.json`, optional test configuration

### Goal

Every pushed branch and pull request receives an objective build-quality signal.

### Scope

- Run dependency installation with the repository lockfile.
- Run `npm run typecheck`.
- Run `npm run lint`.
- Run `npm run build`.
- Run `npm run verify:docs` or the existing `npm run check` if it covers all required steps.
- Cache dependencies where safe.
- Fail on new errors.
- Keep known warnings visible rather than hiding them globally.

### Acceptance criteria

- A GitHub Actions workflow runs on pull requests and pushes to `main`.
- A deliberately broken TypeScript branch fails CI.
- A clean branch passes CI.
- The workflow does not require secrets for ordinary checks.
- The README or contributing documentation names the canonical local verification command.

---

## P0-002 — Audit and normalize all active routes

- **Status:** [ ]
- **Priority:** P0
- **Size:** M
- **Depends on:** P0-001
- **Likely files:** `src/routes/app.*.tsx`, `src/components/app-shell.tsx`, `src/content-workspace.css`, `src/lib/i18n.ts`

### Goal

Ensure every currently reachable page works inside the permanent Academic Content Workspace shell.

### Scope

- Inspect all routes under `/app`.
- Classify each route as `core`, `system`, `legacy-hidden` or `deferred`.
- Fix broken spacing, unreadable controls and obvious shell conflicts.
- Remove remaining immersive-study-room assumptions from active routes.
- Keep deferred routes reachable by direct URL only when they remain functional.
- Remove fake data from active core routes.
- Confirm RU/EN navigation and labels.

### Acceptance criteria

- Dashboard, Courses, Materials, Notes, Flashcards, Quizzes, Import Syllabus, Search, Data and Settings render without layout breakage.
- Core routes contain no fake courses, fake progress or fake schedule entries.
- Deferred routes are absent from primary navigation.
- All active routes work at 390 px, 768 px, 1366 px and 1440 px widths.
- No route imports deprecated immersive visual assets for primary layout.

---

## P0-003 — Remove tracking-first product flows

- **Status:** [ ]
- **Priority:** P0
- **Size:** S
- **Depends on:** P0-002
- **Likely files:** `src/components/app-shell.tsx`, route entry points, `DESIGN_SYSTEM.md`, optional redirect helpers

### Goal

Prevent the obsolete productivity-dashboard concept from competing with the content workflow.

### Scope

- Keep Assignments, Calendar, Study Plan, Progress and Study Session out of primary navigation.
- Remove homepage links to timers, streaks, generic progress and weak-topic widgets.
- Do not delete useful domain data or route code yet.
- Add clear comments or route metadata marking deferred features.
- Preserve direct URLs unless a route is actually broken or misleading.

### Acceptance criteria

- A new user sees only the content workflow in primary navigation.
- No core page asks the user to start a timer or maintain a streak.
- Existing stored calendar, assignment or session data is not deleted.
- Deferred routes do not block build or navigation.

---

# Milestone B — Reliable universal intake

## P0-004 — Create one shared intake service

- **Status:** [ ]
- **Priority:** P0
- **Size:** M
- **Depends on:** P0-001
- **Likely files:** `src/lib/document-ingestion.ts`, new `src/lib/material-intake.ts`, Dashboard and Materials upload components

### Goal

Dashboard and Materials must use the same ingestion pipeline and produce identical material records.

### Scope

- Extract shared upload-to-store logic into one typed service.
- Accept file upload and pasted text.
- Return structured success, partial, unsupported and error results.
- Preserve extraction metadata and generated chunks.
- Centralize filename-based material-type hints without treating them as certainty.
- Prevent duplicate code paths on Dashboard and Materials.

### Acceptance criteria

- Uploading the same file from Dashboard or Materials creates equivalent records.
- No route manually reconstructs a material object differently.
- Extraction errors do not create a fake `ready` material.
- Chunks are persisted only for the correct material.
- The service has unit-testable pure helpers for classification and normalization.

---

## P0-005 — Build multi-file upload queue

- **Status:** [ ]
- **Priority:** P0
- **Size:** L
- **Depends on:** P0-004
- **Likely files:** new intake queue components, store additions or local component state, Dashboard, Materials

### Goal

A user can add an actual course pack without processing files one by one or losing failed items.

### Scope

- Select or drop multiple files.
- Show one queue row per file.
- States: queued, extracting, ready, partial, unsupported, error, cancelled.
- Process with controlled concurrency.
- Allow retry and remove.
- Do not create duplicate saved materials on retry.
- Allow the user to continue using the app while the queue is visible.
- Persist completed material records; queue persistence across reload is optional until cloud jobs exist.

### Acceptance criteria

- At least 10 mixed files can be queued.
- One failed file does not stop remaining files.
- Each file shows its final status and diagnostic message.
- Retry creates at most one saved material.
- Closing and reopening the intake view does not hide unfinished work during the same session.
- Mobile queue remains readable and operable.

---

## P0-006 — Add duplicate detection

- **Status:** [ ]
- **Priority:** P0
- **Size:** M
- **Depends on:** P0-004
- **Likely files:** material intake service, store helpers, upload review UI

### Goal

Avoid silently creating multiple copies of the same source.

### Scope

- Detect exact duplicates using available file metadata and a content fingerprint where possible.
- Detect likely duplicates using filename, size and normalized extracted text.
- Present choices: skip, keep both, replace metadata/content where safe.
- Never merge records automatically.
- Keep previous outputs connected to the original material.

### Acceptance criteria

- Uploading the same file twice produces a duplicate warning.
- Choosing skip creates no second material.
- Choosing keep both creates a clearly distinguishable second material.
- Existing notes, cards and quizzes are not orphaned.
- Duplicate detection works from both Dashboard and Materials.

---

## P0-007 — Add intake review and correction

- **Status:** [ ]
- **Priority:** P0
- **Size:** M
- **Depends on:** P0-004
- **Likely files:** new review dialog/page, Materials route, store mutators

### Goal

Let the user correct Lamdan's guesses before a material becomes part of a course.

### Scope

- Preview title, detected language, material type, source mode and extraction result.
- Choose or change course and topic.
- Edit title and tags.
- Show extracted text preview.
- Show warnings for partial or unsupported extraction.
- Save, save without course, retry or discard.

### Acceptance criteria

- No inferred course association is applied invisibly.
- Blank or invalid metadata is handled safely.
- Hebrew, Russian and English previews render correctly.
- User corrections persist after reload.
- Discard removes temporary state and does not create a material.

---

# Milestone C — Material Workspace

## P0-008 — Replace material detail with a true workspace

- **Status:** [ ]
- **Priority:** P0
- **Size:** L
- **Depends on:** P0-004, P0-007
- **Likely files:** `src/routes/app.materials.$materialId.tsx`, new material workspace components, `src/content-workspace.css`

### Goal

Make the material page the main place where study content is inspected and transformed.

### Required layout

- Material header and metadata.
- Source/chunk navigator.
- Extracted-text workspace.
- Actions and outputs panel.

### Scope

- Show title, course, topic, type, language, status and extraction diagnostics.
- Search inside material text.
- Navigate chunks and pages where available.
- Select one or multiple chunks.
- Copy selected text.
- Show source page or section labels.
- Rename, tag and relink material.
- Show outputs already created from the material.
- Preserve responsive layout without fixed canvas or absolute positioning.

### Acceptance criteria

- A user can see exactly what text exists and which sections are selected.
- Selection survives ordinary component rerenders.
- Material metadata edits persist.
- Empty chunk state and raw-text fallback are handled honestly.
- Existing output links open the correct note, quiz or related page.
- The screen remains usable with long Hebrew text and mixed direction content.

---

## P0-009 — Add chunk editing tools

- **Status:** [ ]
- **Priority:** P0
- **Size:** M
- **Depends on:** P0-008
- **Likely files:** material workspace components, `src/lib/store.ts`

### Goal

Allow the user to fix extraction before AI generation.

### Scope

- Edit chunk title and text.
- Split a chunk at cursor or selection.
- Merge adjacent chunks.
- Reorder chunks.
- Delete a chunk with confirmation.
- Preserve source page/section metadata where logically possible.
- Update dependent `sourceChunkIds` safely when merging or deleting.

### Acceptance criteria

- Edited content persists after reload.
- Split creates two ordered chunks.
- Merge creates one chunk without losing text.
- Reorder changes the order used by AI.
- Deleting a referenced chunk removes only that ID from dependent outputs and warns the user.
- No orphan chunk references remain.

---

## P0-010 — Add material output history

- **Status:** [ ]
- **Priority:** P0
- **Size:** M
- **Depends on:** P0-008
- **Likely files:** material workspace, `src/lib/store.ts`, output-link helpers

### Goal

Show everything already created from a source so the user does not regenerate blindly.

### Scope

- List notes, flashcard generations, quizzes and presentation outlines related to the material.
- Include output type, creation date and linked entity where available.
- Open linked outputs.
- Record generation events consistently.
- Distinguish deleted/missing linked entities.
- Allow removal of history entries without deleting the actual output.

### Acceptance criteria

- Saving a generated note creates a visible output entry.
- Saving cards records the generation even when there is no single deck entity yet.
- Saving a quiz links to the quiz.
- Reopening the material shows prior output history after reload.
- A missing linked entity is displayed honestly rather than causing an error.

---

# Milestone D — AI transformation loop

## P0-011 — Connect AI actions to material selection

- **Status:** [ ]
- **Priority:** P0
- **Size:** M
- **Depends on:** P0-008
- **Likely files:** `src/components/ai-generate-dialog.tsx`, material workspace, AI request helpers

### Goal

The user selects source sections once and generates directly from that context.

### Scope

- Material Workspace actions: create note, create flashcards, create quiz.
- Pass selected material, course, topic and chunk IDs into the existing AI dialog.
- Preselect current chunks.
- Prevent submission with no usable source text.
- Show selected character count and limits.
- Preserve user selection when switching between generation types where practical.

### Acceptance criteria

- Clicking Create note opens a draft flow with the current material and chunks already selected.
- The user does not need to find the material again in a dropdown.
- Saved outputs contain `materialId`, `courseId`, `topicId` and relevant `sourceChunkIds`.
- Invalid or empty selections cannot be sent.
- The existing global AI buttons still work.

---

## P0-012 — Upgrade AI draft review

- **Status:** [ ]
- **Priority:** P0
- **Size:** L
- **Depends on:** P0-011
- **Likely files:** `src/components/ai-draft-modal.tsx`, `src/components/ai-generate-dialog.tsx`, draft editors

### Goal

Make generated content quick to inspect, correct and save without trusting it blindly.

### Scope

- Clear draft state: generating, ready, warning, error, saved.
- Side-by-side or easily accessible source references.
- Edit note title/content/tags.
- Edit, remove, reorder and add flashcards.
- Edit quiz title, prompts, options, correct answers and explanations.
- Regenerate one card or one quiz question where API support exists; otherwise create a scoped follow-up path.
- Confirm before closing with unsaved changes.
- Prevent duplicate save on repeated clicks.

### Acceptance criteria

- Every generated item is editable before save.
- Source chunk references are visible.
- Save is idempotent within one draft session.
- Closing an edited unsaved draft prompts the user.
- AI errors leave the selected source context intact for retry.
- Saving produces exactly one intended output set.

---

## P0-013 — Add AI trust and citation layer

- **Status:** [ ]
- **Priority:** P0
- **Size:** L
- **Depends on:** P0-011, P0-012
- **Likely files:** AI route schemas, prompt templates, result types, draft UI

### Goal

Make it obvious which generated claims are supported by the selected sources.

### Scope

- Require structured source references in AI results where applicable.
- Validate returned chunk IDs against the request.
- Show warnings for uncited or weakly supported items.
- Add explicit `not found in selected sources` behavior.
- Never fabricate a source ID or page number.
- Preserve original Hebrew/English terms when generating Russian explanations.
- Add prompt/model version metadata for debugging.

### Acceptance criteria

- A note, card or question can display its supporting chunks.
- Unknown chunk IDs are rejected or removed with a warning.
- Unsupported answers are labeled rather than presented as sourced facts.
- Russian output can preserve supplied Hebrew terminology.
- Structured-output validation failures are visible and retryable.

---

# Milestone E — Syllabus and course brain

## P0-014 — Complete syllabus review and confirmation

- **Status:** [ ]
- **Priority:** P0
- **Size:** L
- **Depends on:** P0-004, P0-007
- **Likely files:** import syllabus routes, syllabus parser, store helpers

### Goal

A real syllabus should become a usable course only after an explicit review step.

### Scope

- Accept PDF, DOCX, XLSX and pasted text using the shared intake pipeline.
- Extract course title, code, instructor, credits, semester and description.
- Extract weekly topics.
- Extract readings, assignments, exams and grading information where present.
- Display confidence or uncertainty per field.
- Let the user edit, remove and add extracted items.
- Detect likely duplicate courses and previous imports.
- Apply changes only after confirmation.
- Reimport safely without duplicating topics and deadlines.

### Acceptance criteria

- Importing a real Israeli syllabus reaches a review screen before store mutation.
- User can correct every extracted field.
- Cancelling applies nothing.
- Confirming creates or updates one course and its reviewed topics.
- Reimport does not create duplicate topics when the same syllabus is uploaded again.
- Unsupported fields remain empty rather than invented.
- Hebrew field labels and RTL content remain readable.

---

## P0-015 — Build Course Workspace v1

- **Status:** [ ]
- **Priority:** P0
- **Size:** L
- **Depends on:** P0-014, P0-008, P0-010
- **Likely files:** `src/routes/app.courses.$courseId.tsx`, course workspace components

### Goal

Make the course the persistent container for all source material and generated study content.

### Scope

- Course overview with real metadata.
- Topics/weeks list.
- Materials grouped by topic and unassigned materials.
- Related notes, flashcards and quizzes.
- Add material to course.
- Relink material or output to topic.
- Course-level AI actions using explicitly selected sources.
- Show uncovered syllabus topics: topics with no linked material.
- No fake progress or mastery percentage.

### Acceptance criteria

- A course imported from a syllabus has an immediately usable workspace.
- Adding a material updates the course without reimporting.
- Notes, cards and quizzes appear under the correct course.
- The user can identify syllabus topics with no supporting material.
- Course-level AI never silently includes every source; scope is visible and controllable.
- Course data survives reload.

---

# Milestone F — Product-quality content editors

## P0-016 — Upgrade Notes to a reliable editor

- **Status:** [ ]
- **Priority:** P0
- **Size:** L
- **Depends on:** P0-012, P0-015
- **Likely files:** `src/routes/app.notes.tsx`, note editor components, export helpers

### Goal

Generated and manual notes must be useful after the first AI draft.

### Scope

- Stable autosave with visible save state.
- Markdown or rich-text editing with headings, lists, quotes, tables and checklists.
- Mixed RTL/LTR behavior.
- Link to course, topic, material and source chunks.
- Search and filters.
- Duplicate, merge and delete.
- Compare note with source and show missing sections.
- Convert selected note text to flashcards or quiz questions.
- Export Markdown first; DOCX/PDF later if the implementation remains atomic.

### Acceptance criteria

- Editing cannot lose text during ordinary navigation.
- Autosave status is visible.
- Hebrew and Russian can coexist in one note.
- Source references remain accessible after manual edits.
- Merge has a preview and never silently deletes originals.
- Markdown export contains the complete note.

---

## P0-017 — Add Flashcard Studio v1

- **Status:** [ ]
- **Priority:** P0
- **Size:** M
- **Depends on:** P0-012, P0-015
- **Likely files:** `src/routes/app.flashcards.tsx`, new flashcard studio components

### Goal

Make generated cards easy to curate in bulk.

### Scope

- Filter by course, topic and material.
- Bulk select and delete.
- Bulk relink.
- Inline front/back editing.
- Detect exact and likely duplicates.
- Merge or remove duplicates with review.
- Preserve existing review mode but keep spaced repetition visually secondary.
- CSV export and import if it fits without blocking core curation.

### Acceptance criteria

- A generated set of 50 cards can be reviewed without opening 50 dialogs.
- Bulk edits persist.
- Duplicate removal requires confirmation.
- Source links remain attached.
- Review mode still functions after editing.

---

## P0-018 — Add Quiz Studio v1

- **Status:** [ ]
- **Priority:** P0
- **Size:** M
- **Depends on:** P0-012, P0-015
- **Likely files:** quiz list/detail routes, quiz editor components

### Goal

Turn generated questions into a credible reusable exam set.

### Scope

- Edit title and course/material links.
- Add, remove and reorder questions.
- Edit options, correct answer and explanation.
- Validate every multiple-choice question before save.
- Practice mode and exam mode.
- Source reference display.
- Duplicate-question detection.
- Printable export can remain P1 unless trivial.

### Acceptance criteria

- Invalid questions cannot be silently included in an exam.
- Question order persists.
- Practice mode can show feedback immediately.
- Exam mode can postpone feedback until completion.
- Attempts are recorded without becoming the dashboard identity.
- Each sourced question can open its source reference.

---

# Milestone G — Validation and release readiness

## P0-019 — Remove remaining fake and disconnected UI

- **Status:** [ ]
- **Priority:** P0
- **Size:** M
- **Depends on:** P0-002 through P0-018
- **Likely files:** all core routes and shared components

### Goal

Make every visible control either work, explain why it is unavailable or disappear.

### Scope

- Audit all core pages for hardcoded demo content.
- Audit all buttons and links.
- Remove decorative counters not derived from real data.
- Replace dead buttons with implemented flows or honest disabled states.
- Normalize empty states.
- Normalize loading and error states.
- Verify localization coverage.

### Acceptance criteria

- No visible fake course, material, statistic or schedule remains in core routes.
- No clickable control does nothing.
- Disabled actions explain what is missing.
- Empty states point to a real next action.
- RU and EN do not mix accidentally in application chrome.

---

## P0-020 — Create evaluation fixtures

- **Status:** [ ]
- **Priority:** P0
- **Size:** M
- **Depends on:** P0-013, P0-014
- **Likely files:** `fixtures/`, `scripts/`, evaluation documentation

### Goal

Measure whether Lamdan is improving rather than judging AI output by vibes.

### Required fixtures

- Hebrew syllabus.
- Mixed Hebrew/Russian lecture note.
- English academic PDF.
- Short and long documents.
- Deliberately malformed or unsupported file.
- Source with terms that must remain in Hebrew.

### Evaluation categories

- Extraction completeness.
- Language detection.
- Syllabus field accuracy.
- Note completeness and faithfulness.
- Flashcard atomicity and duplication.
- Quiz distractor plausibility.
- Source citation correctness.
- Hallucination rate.

### Acceptance criteria

- Fixtures contain no sensitive personal data.
- Each fixture has expected structured outcomes where practical.
- A repeatable script or checklist runs the same evaluation after AI changes.
- Prompt/model changes can be compared against a previous result.

---

## P0-021 — Run one-course closed pilot

- **Status:** [ ]
- **Priority:** P0
- **Size:** L
- **Depends on:** all previous P0 tasks
- **Likely files:** `PILOT.md`, issue tracker, bug fixes across product

### Goal

Use Lamdan for one complete real course instead of testing isolated screens.

### Pilot script

1. Start from an empty local workspace.
2. Import one real Israeli syllabus.
3. Review and create the course.
4. Upload a representative course pack.
5. Fix extraction problems.
6. Generate one note, one flashcard set and one quiz.
7. Edit and save all outputs.
8. Return after reload and continue.
9. Search for a concept.
10. Prepare a small exam pack.
11. Export all local data.

### Data to record

- Failed uploads.
- Incorrect classification.
- Manual corrections required.
- AI generation failures.
- Unsupported claims or bad citations.
- Time-consuming repeated steps.
- Missing links between source and output.
- Mobile failures.

### Acceptance criteria

- The complete script can be performed without developer intervention.
- No data is lost after reload.
- Every saved output can be traced to a source.
- Critical bugs from the pilot are fixed or explicitly block milestone completion.
- `M1 — Useful personal tool` in `ROADMAP.md` can honestly be marked achieved.

---

# Dependency summary

```text
P0-001 CI
  └─ P0-002 route audit
      └─ P0-003 tracking cleanup

P0-004 shared intake
  ├─ P0-005 upload queue
  ├─ P0-006 duplicate detection
  └─ P0-007 intake review
       └─ P0-008 Material Workspace
            ├─ P0-009 chunk tools
            ├─ P0-010 output history
            └─ P0-011 selected-source AI
                 └─ P0-012 draft review
                      └─ P0-013 AI trust layer

P0-004 + P0-007
  └─ P0-014 syllabus confirmation
       └─ P0-015 Course Workspace
            ├─ P0-016 Notes editor
            ├─ P0-017 Flashcard Studio
            └─ P0-018 Quiz Studio

All core tasks
  ├─ P0-019 fake/dead UI cleanup
  ├─ P0-020 evaluation fixtures
  └─ P0-021 one-course pilot
```

# Recommended implementation batches

## Batch 1 — Make the repository safe to iterate

- P0-001
- P0-002
- P0-003

## Batch 2 — Make intake trustworthy

- P0-004
- P0-005
- P0-006
- P0-007

## Batch 3 — Build the central workspace

- P0-008
- P0-009
- P0-010

## Batch 4 — Make AI generation genuinely useful

- P0-011
- P0-012
- P0-013

## Batch 5 — Make syllabus and course context persistent

- P0-014
- P0-015

## Batch 6 — Make outputs maintainable

- P0-016
- P0-017
- P0-018

## Batch 7 — Validate the actual product

- P0-019
- P0-020
- P0-021

# First task to execute

Start with `P0-001 — Add continuous integration`.

Do not begin Material Workspace or AI redesign until the repository can automatically prove that build, typecheck and lint remain healthy after every change.
