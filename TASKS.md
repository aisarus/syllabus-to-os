# Lamdan — P0 Implementation Tasks and Academic Autopilot Backlog

This is the canonical executable task ledger for Lamdan. Product intent lives in `ROADMAP.md`; active delivery plans live in `PLANS.md`; operational evidence and blockers live in `STATUS.md`.

## Active production-readiness pass — 2026-07-19

The canonical product backlog below remains intact. The current cross-cutting execution order is:

1. `[~] PROD-001` — durable persistence boundary: publish state only after verified storage.
2. `[~] PROD-002` — explicit `WorkspaceRepository`; remove import-order store monkey-patching.
3. `[ ] PROD-003` — shared runtime API schemas, error envelope and bounded AI resource policy.
4. `[ ] PROD-004` — real cancellation for running intake/provider work.
5. `[ ] PROD-005` — keyboard, focus, contrast and mixed-direction accessibility baseline.
6. `[!] PROD-006` — licensed OCR/quiz/transcription evidence and one-course pilot.

Merged main already includes the UX/exam sequence through PR #72; historical entries that mention older active PRs are evidence records, not the current execution state.

## Status legend

- `[ ]` not started
- `[~]` in progress or implemented but not fully verified
- `[x]` complete and verified
- `[!]` blocked by external input or environment

## Global definition of done

Every completed task must satisfy applicable requirements:

- real store data, no fallback demo content;
- browser reload does not silently lose approved work;
- AI, OCR and transcript outputs remain editable drafts until explicit save/apply;
- `materialId` and `sourceChunkIds` relationships remain valid;
- RU/EN chrome and mixed Hebrew/RTL content remain usable;
- desktop and mobile layouts remain operable;
- recommendations expose the evidence used to create them;
- progress or readiness never derives from file views alone;
- `npm run check` passes;
- browser-critical behavior receives E2E coverage when deterministic proof is insufficient;
- documentation names manual/private-data validation honestly.

---

# Completed core sequence

| Task                                                    | Status | Result                                                                                         |
| ------------------------------------------------------- | -----: | ---------------------------------------------------------------------------------------------- |
| P0-001 Add continuous integration                       |    [x] | Contracts, evals, typecheck, lint and build run in CI.                                         |
| P0-002 Audit and normalize active routes                |    [x] | Content-first shell and route inventory are stable.                                            |
| P0-003 Remove tracking-first flows                      |    [x] | Timers, streaks and fake progress are outside primary navigation.                              |
| P0-004 Shared material intake                           |    [x] | Dashboard and Materials use one intake pipeline.                                               |
| P0-005 Multi-file upload queue                          |    [x] | Independent progress, retry and failure states.                                                |
| P0-006 Duplicate detection                              |    [x] | Exact and likely duplicate handling.                                                           |
| P0-007 Intake review and correction                     |    [x] | Metadata and extraction are reviewed before persistence.                                       |
| P0-008 Material Workspace                               |    [x] | Source inspection, selection and actions.                                                      |
| P0-009 Chunk editing                                    |    [x] | Split, merge, reorder and delete.                                                              |
| P0-010 Material output history                          |    [x] | Saved outputs remain linked to sources.                                                        |
| P0-011 Selected-source AI                               |    [x] | Material selection passes directly into generation.                                            |
| P0-012 Editable AI draft review                         |    [x] | Notes, cards and quizzes are editable before save.                                             |
| P0-013 Trust and citation layer                         |    [x] | Unknown source ids are rejected and unsupported claims warned.                                 |
| P0-014 Syllabus review                                  |    [x] | Explicit correction and duplicate-safe confirmation.                                           |
| P0-015 Course Workspace v1                              |    [x] | Persistent course structure and linked content.                                                |
| P0-016 Reliable Notes editor                            |    [x] | Markdown editing, autosave state and source comparison.                                        |
| P0-017 Flashcard Studio v1                              |    [x] | Bulk curation and two-sided review.                                                            |
| P0-018 Quiz Studio v1                                   |    [x] | Validation, editing, practice and exam modes.                                                  |
| P0-019 Core UI honesty audit                            |    [x] | Fake/dead controls removed or explained.                                                       |
| P0-020 Deterministic evaluation fixtures                |    [x] | Syllabus, grounding, multilingual and OCR baselines.                                           |
| P0-021 Durable image intake and OCR review              |    [x] | Original images, editable OCR drafts and explicit apply.                                       |
| P0-022A Image preprocessing                             |    [x] | Non-destructive crop, rotation, deskew and contrast workflow.                                  |
| P0-022B OCR region overlay                              |    [x] | Source-bound boxes and synchronized text/image selection.                                      |
| P0-022C Full visual backup                              |    [x] | Checksummed ZIP restore with rollback.                                                         |
| P0-023 Quizlet cards and golden quizzes                 |    [x] | Two-sided study and grounded bilingual quiz format.                                            |
| P1-001 Multi-page image materials                       |    [x] | Per-page OCR, reorder, partial success and backup.                                             |
| P1-002 Golden quiz quality evaluation                   |    [x] | Category scoring, negative controls and manual review.                                         |
| P1-003 Critical browser E2E                             |    [x] | Real Chromium flows for materials, OCR, cards, quizzes and backup.                             |
| P1-004 Add local-first global search v2                 |    [x] | Ranked multilingual search with URL state and deterministic evals.                             |
| P1-005 Store persistence and source-integrity hardening |    [x] | Failed local writes are visible/exportable; OCR replacement preserves or repairs source links. |

> Historical note: `P0-021` is reserved for durable OCR. The one-course pilot is `P1-008`.

---

# Validation gates

## P1-006 — Live OCR validation on a private real-photo pack

- **Status:** [!]
- **Priority:** P0 validation blocker
- **Size:** M
- **Depends on:** P0-021, P0-022A/B, P1-001, P1-005
- **Blocked by:** four private/licensed source images and a running Lamdan deployment with the multimodal provider

### Required pack

- printed Hebrew academic page;
- handwritten Hebrew notes;
- mixed RTL/LTR photographed mathematics;
- deliberately unreadable/blurred image.

### Execution

```bash
npm run eval:ocr:live -- \
  --base-url https://YOUR-LAMDAN-PREVIEW \
  --asset-dir ./private-ocr-assets
```

### Acceptance criteria

- every fixture has an external candidate;
- CER, WER, critical-token, math-expression and line-order thresholds pass;
- handwriting requests review;
- unreadable input abstains without invented text;
- failure categories and model/prompt version are recorded;
- no private photo is committed.

---

## P1-007 — Live golden quiz validation from a complete Hebrew source pack

- **Status:** [!]
- **Priority:** P0 validation blocker
- **Size:** M
- **Depends on:** P1-002, P1-005
- **Blocked by:** one complete legally usable Hebrew course source pack

### Acceptance criteria

- generation uses explicitly selected source chunks;
- exactly four unique options and one correct answer per question;
- terminology, dates, numbers, rationales and translations are grounded;
- manual review records approve/reject/needs-edit decisions;
- one approved candidate enters the regression set;
- rejected generations remain failure examples.

---

## P1-008 — One-course closed personal pilot

- **Status:** [!]
- **Priority:** P0 milestone gate
- **Size:** L
- **Depends on:** P1-006, P1-007
- **Blocked by:** live OCR and live quiz validation

### Script

1. Start from an empty local workspace.
2. Import and review a real syllabus.
3. Add a representative digital and photographed course pack.
4. Review extraction and OCR.
5. Generate, edit and save a note, cards and quiz.
6. Reload and continue.
7. Search a concept and open its source.
8. Re-run OCR and reorder pages without breaking citations.
9. Export, clear and restore a full ZIP.
10. Record friction and failures in `PILOT.md`.

### Acceptance criteria

- no approved content is lost;
- no visible saved state contradicts persistence;
- every sourced output opens a valid source chunk;
- workflow completes on desktop and mobile width;
- critical findings are fixed or explicitly block M1.

---

## P1-009 — Deep multi-page browser coverage

- **Status:** [ ]
- **Priority:** P1
- **Size:** M
- **Depends on:** P1-001, P1-003, P1-005

### Scope

- page reorder with stable citations;
- one failed OCR page while other pages succeed;
- page replacement and re-review;
- page-level ZIP restore;
- dangling-reference assertion after every flow.

---

## P1-010 — Audio transcription review-and-apply

- **Status:** [~]
- **Priority:** active P1 delivery
- **Size:** L
- **Depends on:** P1-010A durable long-media intake
- **Current PR:** #47

### Delivered in P1-010A / PR #46

- complete local audio/video storage in 8 MB IndexedDB chunks;
- 4 GB local boundary, quota check, cancellation and SHA-256 verification;
- local player, SRT/VTT/TXT import and editable timestamp blocks;
- only approved non-empty transcript blocks become source chunks;
- real 18 MB Chromium upload/apply/reload proof.

### Delivered in P1-010B / PR #47

- optional server-side OpenAI Audio Transcriptions provider;
- exact provider/model/file/size disclosure and explicit consent;
- 24 MB provider-request boundary and separate compressed provider-copy option;
- cancellation, retry, interrupted-tab recovery and persisted attempt count;
- separate local provider candidate with timestamps, speaker labels and uncertainty warnings;
- visible uncovered intervals instead of model-memory gap filling;
- stale source-upload rejection after recording replacement;
- candidate loads into the editor only with `status: "draft"`;
- current source chunks remain unchanged until manual review and Apply;
- consent resets across material/model changes;
- provider timestamps remain inside media duration;
- contract/evals and cancellation → retry → draft → reload Chromium proof.

### Remaining P1-010C work

- automatic local audio extraction/transcoding for originals above one provider request;
- resumable multi-part provider jobs and partial-range recovery;
- streaming backup for raw media, editable transcript drafts and provider candidates;
- live licensed Hebrew/Russian lecture quality, latency and cost validation.

### Non-negotiable boundaries

- no hidden upload during storage, navigation, playback or integrity checking;
- timestamped source sections;
- no automatic trusted transcript;
- cancellation, timeout and retry;
- explicit language and speaker uncertainty;
- missing intervals remain visible;
- outputs retain transcript-section references.

---

# Academic Autopilot sequence

## P1-011 — Study Command Center v1

- **Status:** [x]
- **Priority:** immediate
- **Size:** M
- **Depends on:** existing assignments, calendar, flashcards, quizzes, materials and courses

### Goal

Make the dashboard answer “What should I do now?” from real stored evidence.

### Delivered

- pure deterministic priority engine;
- overdue/upcoming assignment actions;
- exam actions and missing-simulation risk;
- due-card review action;
- weak latest-quiz repair action;
- source-review backlog and ready-source-without-output action;
- empty-workspace fallback;
- 20/45/90 minute bounded plans;
- quick wins, risks and honest counters;
- direct links to useful workspaces;
- RU/EN copy and responsive Academic Content Workspace styling;
- deterministic eval and permanent contract;
- full CI and critical Chromium E2E in PR #36.

### Acceptance criteria

- overdue assignments outrank optional generation;
- an exam within seven days without a quiz attempt creates a risk;
- due cards use real `dueAt` values;
- non-ready sources are visible;
- empty data produces a real intake action;
- study plans never exceed the selected budget;
- no mastery or readiness is invented;
- mobile dashboard remains usable;
- CI passes.

---

## P1-012 — Lecture-to-Study-Pack

- **Status:** [x]
- **Priority:** P1
- **Size:** L
- **Depends on:** P1-008, P1-011, grounded generation

### Goal

One selected lecture/source bundle becomes a coherent guided learning sequence.

### Delivered

- orientation summary;
- structured note;
- concepts and definitions;
- difficult points and explicit unclear areas;
- source-linked cards and diagnostic questions;
- ordered learning steps with time estimates;
- editable combined draft before save;
- atomic save into note, cards and quiz entities;
- full CI and critical Chromium E2E in PR #37.

### Acceptance criteria

- every item cites approved source chunks;
- duplicate items are removed;
- the pack is editable before save;
- one click opens the first learning step;
- partial AI failure does not discard successful sections.

---

## P1-013 — Concept graph and evidence model

- **Status:** [~]
- **Priority:** P1
- **Size:** XL
- **Depends on:** P1-012

### Goal

Represent evidence for recognition, recall, explanation and application without fake mastery.

### Verified v1 delivered in PR #38

- separate local-first concept/evidence store without rewriting `lamdan.data.v1`;
- explicit concept relationships to course, topic, approved chunks, cards and quiz questions;
- linked flashcard recall evidence;
- aggregate quiz attempts retained only as neutral context;
- manual explanation/application events treated as secondary evidence;
- mistake taxonomy;
- recency and forgetting risk;
- `unseen`, `covered`, `fragile`, `weak` and `strong` knowledge-map states;
- strong state requires four successes, two non-manual successes, two days and two evidence kinds;
- targeted source/card/quiz repair actions;
- migration, reconciliation and course-level JSON export/import;
- inspectable and removable evidence history;
- full CI and critical Chromium E2E.

### Remaining scope

- reviewed concept extraction from sources and Study Packs;
- per-question quiz evidence instead of aggregate-only context;
- open-answer and oral evidence;
- integration into the full visual ZIP backup.

### Acceptance criteria

- file views never increase concept state;
- one lucky answer cannot mark mastery;
- repeated manual self-rating alone cannot mark strong evidence;
- evidence is inspectable and removable;
- migration preserves all v1 data;
- deleting or unlinking a source/practice relationship repairs concept evidence safely.

---

## P1-014 — Exam Engine

- **Status:** [ ]
- **Priority:** P1
- **Size:** XL
- **Depends on:** P1-012, P1-013

### Goal

Build an adaptive exam plan from date, format, coverage, evidence and available time.

### Scope

- exam profile and topic weights;
- calm/week-before/tomorrow/emergency modes;
- closed/open/oral/Hebrew formats;
- readiness dimensions;
- bounded daily plan;
- realistic simulation;
- error repair and re-planning;
- transparent score range only when evidence supports it.

### Acceptance criteria

- readiness dimensions show their evidence and uncertainty;
- the plan fits declared time capacity;
- simulation uses the configured format;
- wrong answers create targeted actions;
- emergency mode prioritizes expected score gain, not content volume.

---

## P1-015 — Assignment Copilot

- **Status:** [ ]
- **Priority:** P1
- **Size:** L
- **Depends on:** grounded sources and assignment/calendar entities

### Scope

- requirement and rubric extraction;
- deadline, format and mandatory-source detection;
- stage breakdown;
- thesis/outline/evidence workspace;
- requirement coverage checklist;
- lecturer-eye draft review;
- citation and unsupported-claim checks;
- final submission checklist.

### Acceptance criteria

- extracted requirements remain editable;
- every critique points to the task, rubric or source;
- generated text is distinguishable from user writing;
- Lamdan does not claim a requirement is complete without evidence.

---

## P1-016 — Lecture Mode

- **Status:** [ ]
- **Priority:** P1 after P1-010
- **Size:** L
- **Depends on:** audio transcription, multi-page visual sources, Study Pack

### Scope

- recording where permitted;
- quick notes and timestamp markers;
- board-photo capture;
- important/unclear/exam-likely markers;
- post-lecture source alignment;
- repeated-emphasis detection;
- Study Pack handoff.

---

## P1-017 — Ask My Course

- **Status:** [ ]
- **Priority:** P1
- **Size:** L
- **Depends on:** global search, course memory, grounded AI

### Scope

- selected-course retrieval;
- source-cited answers;
- compare definitions and theories;
- “where did I study this?”;
- answer checking against selected sources;
- Socratic guidance without revealing the answer;
- lecturer-question suggestions.

---

## P1-018 — Intelligent calendar and workload forecast

- **Status:** [ ]
- **Priority:** P1/P2
- **Size:** L
- **Depends on:** assignments, exams, Study Command Center outcomes

### Scope

- confirmed deadline extraction;
- task stage generation;
- realistic duration estimates from completed evidence;
- overloaded-week detection;
- preparation-debt warning;
- capacity and recovery constraints;
- confirmed Google Calendar export later.

---

## P1-019 — Personal explanation and accessibility layer

- **Status:** [ ]
- **Priority:** P1/P2
- **Size:** M
- **Depends on:** Study Pack and Ask My Course

### Scope

- preferred explanation language and structure;
- Hebrew-level control;
- preserve original terminology;
- visual-load and session-length preferences;
- editable explanation profile;
- export and deletion;
- no hidden sensitive inference.

---

# Current execution order

1. Persist per-question quiz evidence and reviewed mistake data under `P1-013`.
2. Add reviewed concept extraction from sources and Study Packs under `P1-013`.
3. Integrate concept/evidence data into the full visual ZIP backup.
4. Supply and run the private OCR pack (`P1-006`).
5. Run and review one real Hebrew golden quiz (`P1-007`).
6. Execute the complete one-course pilot (`P1-008`).
7. Deepen multi-page E2E (`P1-009`).
8. Build Exam Engine (`P1-014`).
9. Add Assignment Copilot (`P1-015`).
10. Add audio, Lecture Mode, Ask My Course, workload forecast and personal explanation (`P1-010`, `P1-016`–`P1-019`).
