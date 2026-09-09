# Lamdan — Portfolio Handoff

Snapshot reviewed: 2026-09-09. The repository itself was last actively pushed in July 2026; this document describes the state that is actually present in `main` and does not promote roadmap items into finished features.

This is an employer-facing case study, not a replacement for `ROADMAP.md`, `STATUS.md`, `TASKS.md`, or the product contracts.

## One sentence

**Lamdan is an AI-first, local-first academic content workspace for Israeli university students that turns syllabi and study materials into structured, searchable, source-linked notes, flashcards, quizzes and study artifacts while keeping AI output reviewable before it becomes saved user data.**

## The product problem

Students do not begin with clean structured knowledge. They begin with PDFs, syllabi, lecture material, screenshots, long recordings and mixed-language documents. A useful study product has to solve more than generation:

- preserve where generated information came from;
- handle Hebrew, Russian, Arabic and English without silently rewriting the source;
- make AI output reviewable instead of presenting it as unquestionable truth;
- keep student work durable when browser persistence fails;
- recover safely from corrupted or partial backups;
- search locally without requiring an embedding service for every lookup;
- make OCR/transcription quality a measurable external gate rather than a demo claim.

Lamdan evolved around those trust boundaries.

## The most important product decision: deleting the wrong product

The first direction was visually ambitious but product-wise weak: an immersive study-room metaphor with illustrated rooms, books, furniture, decorative scenes, progress widgets and fixed-canvas behavior.

That direction was intentionally abandoned.

The current `DESIGN_SYSTEM.md` and `AGENTS.md` explicitly prohibit bringing it back. The canonical product became **Academic Content Workspace**: responsive, editorial, content-first, focused on Courses, Materials, Notes, Flashcards and Quizzes.

The guardrails are unusually explicit:

- no immersive study-room scenes;
- no generated screenshots used as application structure;
- no fake courses or fake progress;
- no streak/timer-first dashboard;
- no fixed 1536×1024 canvas or whole-app `transform: scale()`;
- no decorative 3D furniture/books as the application metaphor;
- new features must support the content-processing workflow directly.

This pivot is central to the case study. The project demonstrates the ability to recognize that an impressive prototype can still be the wrong product, remove sunk-cost features and turn the lesson into permanent constraints for future AI agents.

## Core workflow

The durable product loop is:

`syllabus / material import → extraction → source-linked content → AI draft → user review → saved notes / flashcards / quizzes / study artifacts`

The important word is **draft**. The AI does not silently overwrite user content or publish generated material as trusted state. Source provenance remains attached through material/chunk identifiers, and user confirmation is part of the product contract.

## What exists in the current repository

Lamdan is described in `STATUS.md` as a **late MVP / early closed alpha**. The repository contains product paths for:

- courses and material organization;
- syllabus/material import;
- source-linked notes, flashcards and quizzes;
- reviewed OCR and transcription drafts;
- Study Pack and Quiz Studio;
- Exam Engine / exam planning work;
- local-first multilingual global search;
- long-media handling;
- workspace backup and restore;
- explicit Apply/Save trust boundaries;
- browser E2E and deterministic evaluation suites around critical flows.

This should not be marketed as a finished public learning platform. The interesting portfolio story is how much product/reliability discipline was built into an AI-generated application before claiming production readiness.

## Technical shape

The current stack includes:

- React 19;
- TypeScript;
- TanStack Start / Router / Query;
- Vite;
- Tailwind CSS 4;
- Radix UI primitives;
- Zod validation;
- PDF.js, Mammoth and XLSX-related document processing;
- JSZip for archive workflows;
- browser-local persistence and local-first product flows;
- Node/Bun scripts for deterministic evaluations and contracts.

The project originally grew through Lovable and remains connected to Lovable, but its repository now has explicit agent rules, product contracts, deterministic verification scripts and a substantial conventional development/evaluation surface outside the visual builder.

## Reliability story 1 — “saved” is not allowed to mean “probably saved”

PR #75 fixed a subtle but important storage bug.

### Problem

The workspace store updated in-memory state and notified the UI **before** browser-local persistence was proven durable. If storage failed because of quota, access/security, serialization or read-back mismatch, the interface could show the new state as saved until the next reload erased it.

For a study application, that failure is worse than an immediate error: it lies to the student about the survival of their work.

### Change

The store was changed to **durable-before-publish** semantics:

1. attempt persistence;
2. read back and verify it;
3. only then publish the new state to normal subscribers.

On failure, the previous published snapshot remains authoritative. The application exposes typed persistence failures plus a recovery candidate that can be retried or exported.

Deterministic evaluations cover successful persistence, quota failure, arbitrary storage failure, serialization failure and read-back mismatch.

### What this demonstrates

The project moved from “feature works in the current render” to thinking about data durability, observable truth and recovery semantics.

## Reliability story 2 — backups are treated like untrusted input

Workspace Backup v2 in PR #41 is more than “download JSON / upload JSON”.

Before mutation the restore path checks the archive structure, file kind, size, checksums, unexpected files and uncompressed limits. It supports preview plus merge/replace semantics, protects current evidence when IDs conflict, preserves compatibility with older archives and snapshots the affected local data layers so a failed apply can roll the workspace back.

A dedicated Chromium flow covers:

- normal replace;
- checksum rejection;
- forced write failure;
- rollback;
- reload after recovery.

The important design boundary is simple: **a backup is not trusted merely because Lamdan created a file with a familiar extension.**

## Reliability story 3 — cancellation has to reach the actual provider

PR #85 addressed another common AI-application failure mode: cancelling a request in the UI/runtime without actually aborting the nested network call.

The implementation introduced request-scoped cancellation context and propagated the composed `AbortSignal` down to the external Gemini and transcription provider fetches. The work included deterministic cancellation/provider-context regression evaluations.

The PR explicitly avoids claiming more than was tested: it describes request-scoped Node cancellation, not distributed cancellation across multiple instances, and does not present unavailable full-environment checks as completed evidence.

That restraint is part of the case: test evidence and untested assumptions are separated in the project documentation.

## Product/relevance story — local-first multilingual search

PR #34 replaced simple insertion-order substring matching with deterministic weighted local search.

It searches multiple academic entity types, supports Hebrew with or without niqqud, Unicode normalization, quoted phrases and required multi-term queries, ranks stronger fields ahead of body-only matches, provides contextual snippets/highlights and keeps query/filter state in the URL.

Crucially, the feature is explicitly **browser-local**: no embeddings request, no hidden AI call and no network dependency is required for ordinary search.

This shows an important AI-product judgment: not every intelligent-looking feature should call an AI model.

## Verification philosophy

The repository contains a large verification surface rather than a single `npm test` claim.

`package.json` exposes:

- TypeScript and ESLint checks;
- product/documentation contract verification;
- deterministic evaluation suites for OCR, cancellation, search, store safety, study packs, concept extraction/evidence, question evidence, transcription, backup/restore and other flows;
- real-browser E2E wrappers for critical paths;
- an aggregate `npm run check` command.

The public README states that `npm run check` verifies documentation alignment, permanent product contracts, deterministic evaluations, TypeScript, ESLint and production build; critical real-Chromium flows are also exercised through GitHub workflows.

The important employer-facing point is not the raw number of scripts. It is that product requirements which repeatedly matter are turned into executable contracts so a future AI coding session cannot casually undo them.

## A small debugging example: CI passed locally but the product could still loop

The July 22 history contains a useful smaller incident: the topic-learning CI path and an empty-course render loop were repaired together. The fix hardened piped verification with `pipefail`, improved browser E2E diagnostics/bootstrap and stabilized course-material selection so an empty course no longer triggered the render loop.

This is a good interview example because it combines two classes of false confidence:

- a shell pipeline can report success from the last process while an earlier verification failed;
- a UI can satisfy static contracts and still have a runtime state-transition loop.

## What was deliberately left unproven

This section matters as much as the feature list.

`STATUS.md` keeps several external quality gates blocked rather than replacing them with synthetic demo evidence:

- real OCR quality still requires private/licensed Hebrew and mixed-content images plus a provider-enabled deployment;
- golden Hebrew quiz quality requires a legally usable complete source pack and human review;
- the one-course closed pilot depends on those quality gates;
- licensed Hebrew/Russian lecture evaluation still requires real credentials, reviewed reference material, latency and cost evidence.

So the portfolio must **not** claim verified real-world OCR accuracy, successful closed-pilot learning outcomes or production-scale provider performance.

## What the author actually did

Lamdan is an AI-native build. A substantial amount of implementation work was performed with Lovable and coding agents. The honest role is therefore not “I manually wrote every React/TypeScript line”.

A more accurate professional description is:

**Product owner / AI-native product builder responsible for product direction, requirements, iterative acceptance, failure diagnosis and the constraints under which AI implementation agents worked.**

That work included:

- defining the original study-product problem;
- repeatedly translating fuzzy product ideas into implementation tasks;
- recognizing that the immersive “study room” direction was visually interesting but strategically wrong;
- removing or demoting features that did not support the content workflow;
- creating permanent design/product guardrails so future agents could not reintroduce old mistakes;
- deciding that AI outputs should remain source-linked reviewable drafts;
- pushing the application from prototype behavior toward durability, cancellation, rollback and deterministic evaluation;
- reviewing generated implementations through PR-level evidence rather than accepting “done” from the coding agent;
- keeping external quality gates honestly blocked where legal/private test data was unavailable;
- maintaining a repository that another agent can enter through `AGENTS.md`, `TASKS.md`, `STATUS.md`, `ROADMAP.md` and executable verification commands.

## Skills this case can credibly support

Lamdan is evidence for:

- AI-assisted product development;
- rapid prototyping followed by product correction;
- requirements and product-guardrail design;
- human-in-the-loop AI UX;
- source provenance / trust-oriented AI product design;
- local-first application thinking;
- multilingual product constraints, including Hebrew/Russian mixed content;
- deterministic evaluation design;
- browser E2E acceptance;
- failure/recovery product design;
- AI provider cancellation and bounded execution concepts;
- iterative PR-based development with coding agents;
- design-system and information-architecture ownership.

It should **not** be used to claim senior-level manual React engineering, production ML/OCR expertise, or validated educational efficacy.

## What an employer can inspect directly

Because `aisarus/syllabus-to-os` is public, this project is particularly useful as a hiring artifact.

Recommended reading order:

1. [`README.md`](../../README.md) — concise product and verification entry point;
2. [`DESIGN_SYSTEM.md`](../../DESIGN_SYSTEM.md) — the product/design pivot and permanent guardrails;
3. [`STATUS.md`](../../STATUS.md) — evidence, stage and explicit blockers;
4. [`PILOT.md`](../../PILOT.md) — what a real validation pass is supposed to prove;
5. PR #75 — durable-before-publish persistence;
6. PR #41 — checksum/rollback workspace backup;
7. PR #34 — deterministic local-first multilingual search;
8. PR #85 — cancellation propagation to external AI providers.

Public PR links:

- https://github.com/aisarus/syllabus-to-os/pull/75
- https://github.com/aisarus/syllabus-to-os/pull/41
- https://github.com/aisarus/syllabus-to-os/pull/34
- https://github.com/aisarus/syllabus-to-os/pull/85

## Portfolio-ready narrative

### Hero

> **AI can generate study material. Lamdan is about making that material trustworthy enough to keep.**
>
> I evolved an experimental Lovable-built study app into a source-linked, local-first academic workspace with explicit review boundaries, durable persistence, deterministic evaluation and multilingual student workflows.

### Three proof points

1. **Product correction over sunk cost.** The original immersive Study Room was deliberately abandoned and permanently guarded against when it became clear that decoration was replacing the study workflow.
2. **AI output is draft, not truth.** Generated study artifacts stay linked to their source material and require an explicit save/review boundary.
3. **Prototype → reliability.** Persistence, backup rollback, provider cancellation, browser E2E and explicit quality gates became first-class product work rather than afterthoughts.

## CV-ready entry

**Lamdan — AI-first Academic Content Workspace · Product Owner / AI-native Builder**

Evolved an experimental AI study app into a local-first academic content workspace for multilingual university material. Defined the product pivot from an immersive visual prototype to a source-linked content workflow, established permanent UX/AI guardrails, and led AI-assisted implementation across syllabus/material intake, local search, reviewed study generation and reliability work. Introduced evidence-driven acceptance around durable persistence, checksum/rollback backups, provider cancellation and browser E2E while keeping unvalidated OCR and educational-quality claims explicitly gated.

## Suggested screenshots / portfolio media to capture later

The public case study will be much stronger with a small, curated media set rather than generic UI screenshots:

1. one current desktop workspace overview;
2. one mobile layout/drawer view;
3. syllabus/material intake → source-linked material;
4. an AI-generated draft showing the explicit review/save boundary;
5. global multilingual search with Hebrew/Russian content;
6. workspace backup preview / restore trust UI;
7. a before/after visual showing the abandoned Study Room direction versus the current Academic Content Workspace.

The last comparison is especially valuable because it visually communicates product judgment, not only implementation skill.

## Short conclusion

Lamdan should not be presented as “I made a study app with Lovable”.

The stronger and more accurate story is:

**I used AI tools to prototype aggressively, recognized when the prototype optimized the wrong thing, changed the product direction, encoded the lessons as permanent agent constraints, and then moved the project toward trustworthy user data and verifiable behavior instead of adding more demo features.**