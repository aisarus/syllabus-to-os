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

## Completed Academic Autopilot slices

- `P1-011 Study Command Center v1` — merged in PR #36.
- `P1-012 Lecture-to-Study-Pack` — merged in PR #37.
- `P1-013 Concept graph and evidence model v1` — merged in PR #38.
- `P1-013A Per-question quiz evidence` — merged in PR #39 after deterministic and Chromium persistence gates.
- `P1-013B Workspace backup v2` — merged in PR #41 after contracts, deterministic evals, TypeScript, lint, build and three Chromium gates.
- `P1-013C Reviewed concept extraction` — verified in PR #42 after contracts, deterministic evals, TypeScript, lint, build and four Chromium gates.

## Verified delivery — Reviewed concept extraction

### Product outcome

Lamdan can propose atomic course concepts from explicitly selected approved source chunks or saved Study Pack key terms, while the user remains responsible for every title, description, alias and source relationship before anything enters the knowledge map.

### Delivered sequence

1. Added an ephemeral concept-candidate model with citation filtering and duplicate detection. ✓
2. Parsed saved Study Pack `Key terms` / `Ключевые термины` sections locally. ✓
3. Added a strict source-only AI extraction prompt and API route. ✓
4. Limited AI extraction to eight explicitly selected chunks. ✓
5. Removed uncited and unknown-source candidates server-side. ✓
6. Supplied current titles and aliases as a do-not-duplicate list. ✓
7. Added an editable review UI for title, description, aliases and source links. ✓
8. Blocked duplicates against the current map and original candidate batch; required explicit selection. ✓
9. Created source-linked concepts without creating evidence or raising knowledge state. ✓
10. Added deterministic parser, citation and duplicate evaluations. ✓
11. Added browser proof for Study Pack extraction, review, acceptance and reload with zero evidence events. ✓
12. Wired permanent contracts, canonical checks and CI. ✓
13. Passed all contracts, evals, TypeScript, lint, build and four browser gates. ✓

### Non-negotiable boundaries

- Candidate generation never auto-saves.
- User instructions can shape focus but are never treated as a factual source.
- Every accepted candidate needs at least one still-valid approved source chunk.
- Existing-map and generated-batch duplicate titles or aliases are blocked.
- Saved Study Pack terms carry coarse note-level citations and show that limitation.
- Accepting a concept creates no learning evidence.
- No mastery state, score prediction or ontology edge is inferred from extraction.
- Cross-candidate alias/title collisions introduced only through later manual edits remain a small hardening follow-up.

## Active next delivery

1. Add the final edited-batch alias collision guard.
2. Add open-answer evidence and mistake-repair flows.
3. Build `P1-014 Exam Engine` on stable evidence, source coverage and deadlines.
4. Continue `P1-015`–`P1-019` only through source-visible and reviewable contracts.
