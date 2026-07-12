# Lamdan

Lamdan is an AI-first academic content workspace for students in Israel. It turns syllabi and study materials into structured courses, searchable source content, notes, flashcards and quizzes while preserving links back to the original material.

## Product direction

The current product foundation is **Academic Content Workspace**: a restrained editorial interface focused on courses, materials, notes, flashcards and quizzes. Tracking dashboards, streaks, timers and illustrated-room interfaces are not part of the core product.

Read the project contracts before implementation:

- `AGENTS.md` — repository and agent rules;
- `ROADMAP.md` — long-term product roadmap;
- `TASKS.md` — ordered P0 implementation tasks;
- `DESIGN_SYSTEM.md` — permanent visual and UX rules;
- `STATUS.md` — current execution status and blockers.

## Local setup

The repository uses `bun.lock` as its dependency lockfile.

```bash
bun install --frozen-lockfile
npm run dev
```

## Canonical verification

Before committing a task, run:

```bash
npm run check
```

That command verifies the documentation contract, TypeScript, ESLint and the production build. GitHub Actions runs the same quality gates for pull requests and pushes to `main`.

Individual checks are also available:

```bash
npm run verify:docs
npm run typecheck
npm run lint
npm run build
```
