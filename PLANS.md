# Lamdan implementation plans

This file records the active implementation plan. Product intent remains in `ROADMAP.md`; canonical task status and acceptance criteria live in `TASKS.md`; evidence and blockers live in `STATUS.md`.

## M1 validation plan — P1-006 to P1-008

**Status:** externally blocked, infrastructure ready.

1. Place four private/licensed images in `private-ocr-assets/`.
2. Run `npm run eval:ocr:live` against a connected Lamdan preview.
3. Classify and fix live OCR failure categories.
4. Generate one golden quiz from a complete Hebrew source pack and review every question.
5. Promote an approved quiz candidate into permanent fixtures.
6. Run the complete one-course pilot in `PILOT.md`.
7. Fix every critical data-loss, provenance or mobile blocker before declaring M1.

## Active delivery — P1-011 Study Command Center v1

**Status:** implemented in `agent/academic-autopilot-roadmap`; awaiting full CI and browser review.

### Product outcome

The dashboard stops being a content inventory and becomes a daily decision surface that answers “What should I do now?” from real data.

### Implementation sequence

1. Add a pure priority engine over assignments, exam events, due cards, quiz attempts, source state and course coverage. ✓
2. Add bounded 20/45/90 minute study-plan composition. ✓
3. Render one main action, quick wins, risks and honest counters on Dashboard. ✓
4. Preserve universal intake and existing AI actions below the command center. ✓
5. Add RU/EN copy and responsive Academic Content Workspace styling. ✓
6. Add deterministic scenarios and a permanent contract. ✓
7. Wire package, local check and GitHub Actions quality gates. In progress.
8. Run CI, inspect browser layout and fix failures before merge. Pending.

### Explicit boundaries

- No schema migration in v1.
- No invented mastery or readiness percentage.
- No recommendation from file views or scrolling.
- Every action opens an existing useful workspace.
- Missing data produces an honest intake or continuation action.

## Next delivery — P1-012 Lecture-to-Study-Pack

**Status:** planned after P1-011 verification and M1 blocker fixes.

### Vertical slice

1. Select one approved material or a small same-course source bundle.
2. Generate a typed pack draft with orientation, note, concepts, glossary, cards, questions and unclear areas.
3. Preserve source references for every generated section.
4. Show the pack as one guided sequence rather than disconnected outputs.
5. Allow section-level edit, regenerate, save and retry.
6. Launch the first study step directly from Today.
7. Record completion evidence without calling it mastery.

### First acceptance target

A real Hebrew lecture plus Russian explanations becomes a useful 25–35 minute learning sequence with no unsupported claims and no manual prompt construction.

## Follow-on architecture

After Study Pack:

1. `P1-013` — add concepts, evidence events and mistake taxonomy with a migration.
2. `P1-014` — build Exam Engine on source coverage and learning evidence.
3. `P1-015` — build Assignment Copilot using grounded requirement and rubric extraction.
4. `P1-010` and `P1-016` — add audio transcription and Lecture Mode through the same review/apply contract.
5. `P1-017`–`P1-019` — Ask My Course, workload forecasting and personal explanation preferences.
