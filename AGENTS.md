<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Lamdan product guardrails

Read `DESIGN_SYSTEM.md` before changing application UI.

Lamdan is a study-content workspace for Israeli university students. The core workflow is:

syllabus/material import → extraction → notes/flashcards/quizzes → saved source-linked content.

## Do not reintroduce

- immersive study-room scenes;
- generated dashboard screenshots as backgrounds;
- fixed 1536×1024 canvases;
- transform-based whole-app scaling;
- 3D books, furniture, lamps, plants or decorative rooms;
- fake progress percentages;
- streaks, study-hour counters or timer-first dashboards;
- Progress or Study Session in primary navigation;
- hardcoded fake courses, schedules or materials.

## Permanent foundation

- Shell: `src/components/app-shell.tsx`
- Tokens and layout: `src/content-workspace.css`
- Global portal/theme tokens: `src/content-workspace-global.css`
- Product/design specification: `DESIGN_SYSTEM.md`

Primary navigation must remain focused on Courses, Materials, Notes, Flashcards and Quizzes. New features must support the content-processing workflow directly.

Preserve:

- existing store schemas and localStorage compatibility;
- source links (`materialId`, `sourceChunkIds`);
- RU/EN UI localization;
- user-created/imported Hebrew, Arabic, Russian and English content without silent translation;
- AI draft review before saving.
