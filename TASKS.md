# Lamdan — P0 Implementation Tasks and Current Backlog

This is the canonical executable task ledger for Lamdan. Product intent lives in `ROADMAP.md`; operational evidence and blockers live in `STATUS.md`.

The old task file accumulated stale unchecked tasks after the code had already shipped. This version intentionally keeps completed history compact and gives full acceptance criteria only to active work.

## Status legend

- `[ ]` not started
- `[~]` in progress
- `[x]` complete and verified
- `[!]` blocked by an external input or environment

## Global definition of done

Every completed task must satisfy the applicable requirements:

- real store data, no fallback demo content;
- browser reload does not silently lose approved work;
- AI and OCR outputs remain editable drafts until explicit save/apply;
- `materialId` and `sourceChunkIds` relationships remain valid;
- RU/EN chrome and mixed Hebrew/RTL content remain usable;
- desktop and mobile layouts remain operable;
- `npm run check` passes;
- browser-critical behavior receives E2E coverage when it cannot be proven deterministically;
- documentation names remaining manual or private-data validation honestly.

---

# Completed core sequence

| Task | Status | Result |
|---|---:|---|
| P0-001 Add continuous integration | [x] | Canonical contracts, evals, typecheck, lint and build run in CI. |
| P0-002 Audit and normalize active routes | [x] | Content-first shell and route inventory are stable. |
| P0-003 Remove tracking-first flows | [x] | Timers, streaks and fake progress are outside primary navigation. |
| P0-004 Shared material intake | [x] | Dashboard and Materials use one intake pipeline. |
| P0-005 Multi-file upload queue | [x] | Independent progress, retry and failure states. |
| P0-006 Duplicate detection | [x] | Exact and likely duplicate handling. |
| P0-007 Intake review and correction | [x] | Metadata and extraction are reviewed before persistence. |
| P0-008 Material Workspace | [x] | Source inspection, selection and actions. |
| P0-009 Chunk editing | [x] | Split, merge, reorder and delete. |
| P0-010 Material output history | [x] | Saved outputs remain linked to sources. |
| P0-011 Selected-source AI | [x] | Material selection passes directly into generation. |
| P0-012 Editable AI draft review | [x] | Notes, cards and quizzes are editable before save. |
| P0-013 Trust and citation layer | [x] | Unknown source ids are rejected and unsupported claims warned. |
| P0-014 Syllabus review | [x] | Explicit correction and duplicate-safe confirmation. |
| P0-015 Course Workspace v1 | [x] | Persistent course structure and linked content. |
| P0-016 Reliable Notes editor | [x] | Markdown editing, autosave state and source comparison. |
| P0-017 Flashcard Studio v1 | [x] | Bulk curation and two-sided review. |
| P0-018 Quiz Studio v1 | [x] | Validation, editing, practice and exam modes. |
| P0-019 Core UI honesty audit | [x] | Fake/dead controls removed or explained. |
| P0-020 Deterministic evaluation fixtures | [x] | Syllabus, grounding, multilingual and OCR baselines. |
| P0-021 Durable image intake and OCR review | [x] | Original images, editable OCR drafts and explicit apply. |
| P0-022A Image preprocessing | [x] | Non-destructive crop, rotation, deskew and contrast workflow. |
| P0-022B OCR region overlay | [x] | Source-bound boxes and synchronized text/image selection. |
| P0-022C Full visual backup | [x] | Checksummed ZIP restore with rollback. |
| P0-023 Quizlet cards and golden quizzes | [x] | Two-sided study and grounded bilingual quiz format. |
| P1-001 Multi-page image materials | [x] | Per-page OCR, reorder, partial success and backup. |
| P1-002 Golden quiz quality evaluation | [x] | Category scoring, negative controls and manual review. |
| P1-003 Critical browser E2E | [x] | Real Chromium flows for materials, OCR, cards, quizzes and backup. |
| P1-004 Local-first global search v2 | [x] | Ranked multilingual search with URL state and deterministic evals. |
| P1-005 Store persistence and source-integrity hardening | [x] | Failed local writes are visible and exportable; OCR chunk replacement preserves or repairs source links. |

> Historical note: an older draft used `P0-021` for the one-course pilot while later implementation used it for durable OCR. The canonical ledger now reserves `P0-021` for OCR and identifies the pilot as `P1-008`.

---

# Active validation sequence

## P1-006 — Live OCR validation on a private real-photo pack

- **Status:** [!]
- **Priority:** P0 validation blocker
- **Size:** M
- **Depends on:** P0-021, P0-022A/B, P1-001, P1-005
- **Blocked by:** four private or licensed source images and a running Lamdan deployment with the connected multimodal provider

### Goal

Measure actual OCR/HTR behavior instead of treating recorded fixtures as proof of live quality.

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

The command calls the real `/api/ai/ocr-image` route, writes private candidates outside git and runs the permanent OCR metrics.

### Acceptance criteria

- every fixture has an external candidate;
- CER, WER, critical-token, math-expression and line-order thresholds pass;
- handwriting requests review;
- unreadable input abstains without invented text;
- failure categories and model/prompt version are recorded in `PILOT.md` or a linked private report;
- no private photo is committed.

---

## P1-007 — Live golden quiz validation from a complete Hebrew source pack

- **Status:** [!]
- **Priority:** P0 validation blocker
- **Size:** M
- **Depends on:** P1-002, P1-005
- **Blocked by:** one complete, legally usable Hebrew course source pack

### Goal

Generate a real quiz, review every question in the quality workspace and promote only an approved candidate into permanent fixtures.

### Acceptance criteria

- generation uses explicitly selected source chunks;
- exactly four unique options and one correct answer per question;
- numbers, dates, terminology, rationales and translations are source-grounded;
- manual review records approve/reject/needs-edit decisions;
- at least one approved candidate is promoted to the regression set;
- rejected generations remain visible as failure examples rather than being silently discarded.

---

## P1-008 — One-course closed personal pilot

- **Status:** [!]
- **Priority:** P0 milestone gate
- **Size:** L
- **Depends on:** P1-006, P1-007
- **Blocked by:** completion of live OCR and live quiz validation

### Goal

Use one real Israeli course end to end without developer intervention.

### Script

1. Start from an empty local workspace.
2. Import and review a real syllabus.
3. Create the course and topics.
4. Add a representative digital and photographed course pack.
5. Review extraction and OCR.
6. Generate, edit and save a note, cards and quiz.
7. Reload and continue.
8. Search for a concept and open its source.
9. Re-run OCR on one page and confirm existing citations survive.
10. Reorder a multi-page material and confirm links remain valid.
11. Export a full ZIP, clear data and restore it.
12. Record friction and failures in `PILOT.md`.

### Acceptance criteria

- no approved content is lost after reload;
- no visible saved state contradicts browser persistence;
- every sourced output opens a valid source chunk;
- the workflow completes on desktop and a mobile-width viewport;
- critical pilot findings are fixed or explicitly block M1;
- `ROADMAP.md` may mark M1 achieved only after this task passes.

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

- **Status:** [ ]
- **Priority:** P1 after M1 validation
- **Size:** L
- **Depends on:** P1-008

### Goal

Add MP3/M4A/WAV as a source using the same durable draft, uncertainty, review and explicit-apply contract as OCR.

### Non-negotiable boundaries

- timestamped source sections;
- no automatic trusted transcript;
- cancellation, timeout and retry;
- explicit language and speaker uncertainty;
- generated outputs retain transcript-section references;
- audio work must not postpone fixes discovered by the one-course pilot.

---

# Current execution order

1. Supply and run the private OCR pack (`P1-006`).
2. Run and manually review one real Hebrew golden quiz (`P1-007`).
3. Execute the complete one-course pilot (`P1-008`).
4. Fix pilot blockers and deepen multi-page E2E (`P1-009`).
5. Begin audio transcription only after M1 is honestly achieved (`P1-010`).
