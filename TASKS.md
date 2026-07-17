# Lamdan — implementation tasks and Academic Autopilot backlog

This is the canonical executable task ledger. Product intent lives in `ROADMAP.md`; the active slice lives in `PLANS.md`; operational evidence and blockers live in `STATUS.md`.

## Status legend

- `[ ]` not started
- `[~]` active or partially delivered
- `[x]` complete and verified
- `[!]` blocked by external input or environment

## Global definition of done

A completed task must satisfy every applicable requirement:

- real store data, no fallback demo content;
- reload does not silently lose approved work;
- AI, OCR and transcript output remains editable until explicit save/apply;
- material, page, region and source-chunk relationships remain valid;
- RU/EN chrome and mixed Hebrew/RTL content remain usable;
- desktop and mobile layouts remain operable;
- recommendations expose their evidence;
- progress/readiness never derives from file views alone;
- `npm run check` passes;
- browser-critical behavior has a permanent Chromium proof;
- manual or external validation is named honestly.

---

# Completed foundation

| Task | Status | Result |
| --- | ---: | --- |
| P0-001 Continuous integration | [x] | Contracts, evals, typecheck, lint, build and browser gates. |
| P0-002 Route normalization | [x] | Stable content-first route inventory. |
| P0-003 Remove tracking-first flows | [x] | No streak/timer vanity workflow in primary navigation. |
| P0-004 Shared material intake | [x] | Dashboard and Materials use one pipeline. |
| P0-005 Multi-file queue | [x] | Independent progress, retry and failure. |
| P0-006 Duplicate detection | [x] | Exact and likely-duplicate review. |
| P0-007 Intake review | [x] | Metadata/extraction correction before persistence. |
| P0-008 Material Workspace | [x] | Source inspection, selection and actions. |
| P0-009 Chunk editing | [x] | Split, merge, reorder and delete. |
| P0-010 Output history | [x] | Saved outputs retain source relationships. |
| P0-011 Selected-source AI | [x] | Selection passes directly into generation. |
| P0-012 Editable AI review | [x] | Notes, cards and quizzes reviewed before save. |
| P0-013 Trust/citation layer | [x] | Unknown source ids rejected; unsupported claims visible. |
| P0-014 Syllabus review | [x] | Explicit correction and duplicate-safe confirmation. |
| P0-015 Course Workspace | [x] | Persistent course structure and linked content. |
| P0-016 Notes editor | [x] | Markdown editing, autosave and source comparison. |
| P0-017 Flashcard Studio | [x] | Bulk curation and two-sided review. |
| P0-018 Quiz Studio | [x] | Validation, editing and practice/exam modes. |
| P0-019 UI honesty audit | [x] | Dead or misleading controls removed/explained. |
| P0-020 Evaluation fixtures | [x] | Syllabus, grounding, multilingual and OCR baselines. |
| P0-021 Durable image/OCR intake | [x] | Original image, draft review and explicit apply. |
| P0-022A Image preprocessing | [x] | Non-destructive crop, rotation, deskew and contrast. |
| P0-022B OCR region overlay | [x] | Source-bound boxes and synchronized selection. |
| P0-022C Visual backup/restore | [x] | Checksummed restore with rollback. |
| P0-023 Cards and golden quizzes | [x] | Grounded bilingual study formats. |
| P1-001 Multi-page image materials | [x] | Page order, partial OCR and backup. |
| P1-002 Golden quiz evaluator | [x] | Category scoring and negative controls. |
| P1-003 Critical browser E2E | [x] | Materials, OCR, cards, quizzes and restore. |
| P1-004 Global search v2 | [x] | Ranked multilingual local search. |
| P1-005 Store/source hardening | [x] | Visible write failures and relationship repair. |

---

# External validation gates

## P1-006 — Live OCR validation

- **Status:** [!]
- **Blocked by:** four legally usable representative images and a configured reachable deployment.

Acceptance:

- printed Hebrew, handwriting, mixed RTL/LTR mathematics and unreadable input;
- CER/WER, critical tokens, math and line-order thresholds;
- handwriting requests review;
- unreadable input abstains;
- no validation image is committed.

## P1-007 — Live Hebrew golden-quiz validation

- **Status:** [!]
- **Blocked by:** one complete legally usable Hebrew course source pack.

Acceptance:

- explicitly selected source chunks;
- four unique options and one correct answer;
- grounded terms, dates, numbers, rationale and translation;
- recorded approve/reject/edit decisions;
- one approved candidate becomes a regression fixture.

## P1-008 — One-course closed pilot

- **Status:** [!]
- **Depends on:** P1-006 and P1-007.

Acceptance:

- empty workspace → syllabus → mixed source pack → review → note/cards/quiz;
- reload and continue;
- search opens the correct source;
- OCR rerun/page reorder preserves citations;
- export, clear and restore succeeds;
- desktop and mobile-width completion;
- no approved content or source relationship is lost.

---

# Active delivery

## P1-009 — Deep multi-page browser coverage

- **Status:** [~]
- **Priority:** active P1
- **Depends on:** P1-001, P1-003 and P1-005

Scope:

- page reorder with stable citations;
- one failed OCR page while successful siblings remain usable;
- page replacement and re-review;
- page-level visual export/restore;
- reload between destructive transitions;
- dangling material/page/region/source-chunk assertion after every flow.

Acceptance:

- reorder never moves a citation to another page;
- one failed page never invalidates successful siblings;
- replacement repairs stale relationships;
- restore publishes only verified complete state;
- unreadable content remains failed or review-required;
- permanent contract, Chromium workflow and full CI pass.

---

# Delivered lecture-media sequence

## P1-010 — Audio transcription review and apply

- **Implementation status:** [x]
- **Live provider-quality evidence:** [!]

Delivered:

- `P1-010A` complete local audio/video storage, quota checks, cancellation and per-chunk SHA-256 — PR #46;
- `P1-010B` explicit provider consent, bounded request, retry, stale-source rejection and draft-only candidate — PR #47;
- `P1-010C1` resumable overlapping range queues and partial recovery — PR #48;
- `P1-010C2` local range extraction/transcoding with manual fallback — PR #52;
- `P1-010C3` streaming `.lamdan-lecture` export — PR #53;
- `P1-010C4` verified duplicate restore with complete rollback — PR #54;
- `P1-010C5` offline Hebrew/Russian quality evaluator — PR #57.

Non-negotiable boundaries:

- no hidden upload during storage, navigation, playback or integrity checking;
- exact provider/model/file disclosure before upload;
- missing intervals remain visible;
- provider output remains untrusted draft data;
- no automatic source chunks;
- cancelled/failed work cannot replace approved content;
- stale recording identities are rejected.

Live-quality gate:

- requires legally usable Hebrew/Russian recordings;
- exact human reference transcripts;
- reviewed candidates produced by the deployment under evaluation;
- records WER/CER, timestamp/speaker coverage, uncertainty, latency, real-time factor and cost.

---

# Delivered Academic Autopilot foundation

## P1-011 — Study Command Center

- **Status:** [x]
- **PR:** #36

Deterministic evidence-backed next actions, bounded 20/45/90-minute plans, visible risks and direct workspace links.

## P1-012 — Lecture-to-Study-Pack

- **Status:** [x]
- **PR:** #37

Source-linked orientation, note, concepts, difficult points, cards, questions and ordered steps in one editable atomic save flow.

## P1-013 — Concept graph and evidence

- **Status:** [x] for the planned v1 sequence
- **PRs:** #38, #39, #41, #42, #43 and #44

Delivered:

- concept/source/card/question relationships;
- recognition, recall, explanation and application evidence;
- inspectable/removable history;
- forgetting risk and honest knowledge-map states;
- per-question quiz evidence;
- reviewed concept extraction;
- open-answer mistake repair;
- full workspace backup integration;
- edited-batch collision guard.

Boundary:

- file views never increase evidence;
- one lucky answer cannot mark strong state;
- manual self-rating alone cannot mark strong evidence;
- relationship deletion/replacement reconciles evidence safely.

## P1-014 — Exam Engine

- **Status:** [~]

Delivered:

- `P1-014A` frozen source-grounded multiple-choice sessions — PR #45;
- immutable questions/options/answers/source ids after start;
- deadline, partial-answer and reload persistence;
- per-question evidence only for actual answers;
- raw score without unsupported grade prediction;
- `P1-014B` separate bounded exam-planning profile — PR #58;
- exam date, weekdays, daily/session limits and topic weights;
- deterministic final-180-day allocation;
- original and combined planning/exam Chromium proofs.

Remaining optional expansion:

- open-answer/oral simulation formats;
- calm/week-before/tomorrow/emergency presentation modes;
- evidence-visible readiness dimensions;
- targeted re-planning after simulation mistakes;
- score ranges only when evidence and uncertainty support them.

---

# Next product slices

## P1-015 — Assignment Copilot

- **Status:** [ ]
- **Priority:** next after P1-009

Scope:

- editable requirement/rubric extraction;
- deadline, format and mandatory-source detection;
- stage breakdown;
- thesis/outline/evidence workspace;
- requirement coverage checklist;
- lecturer-eye draft review;
- citation and unsupported-claim checks;
- final submission checklist.

Acceptance:

- every critique points to the assignment, rubric or source;
- generated text is distinguishable from user writing;
- no requirement is marked complete without evidence.

## P1-016 — Lecture Mode

- **Status:** [ ]

Recording where permitted, quick timestamped notes, board photos, important/unclear markers, post-lecture alignment and Study Pack handoff.

## P1-017 — Ask My Course

- **Status:** [ ]

Selected-course retrieval, source-cited answers, theory comparison, source location, answer checking and Socratic guidance.

## P1-018 — Calendar and workload forecast

- **Status:** [ ]

Confirmed deadlines, task stages, evidence-based duration estimates, overloaded-week detection, preparation debt and capacity constraints.

## P1-019 — Explanation and accessibility profile

- **Status:** [ ]

Explanation language/structure, Hebrew level, preserved terminology, visual-load/session preferences, editable exportable profile and no hidden sensitive inference.

---

# Current execution order

1. Merge `P1-009` deep multi-page browser coverage.
2. Build `P1-015 Assignment Copilot`.
3. Build `P1-016 Lecture Mode`.
4. Build `P1-017 Ask My Course`.
5. Build `P1-018 workload forecast`.
6. Build `P1-019 explanation/accessibility profile`.
7. Run P1-006, P1-007, P1-008 and live lecture-quality gates when their required external inputs are supplied.
