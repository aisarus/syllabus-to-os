# S4-001 CourseWorkspace accessibility inventory

Baseline: `b5dd5e4c50bffc11c7f896fbcc1fad75d4353eb9`

Scope: representative study surface only. Existing AppShell keyboard/focus E2E is not repeated here.

## Confirmed findings

### Topic creation input

File: `src/components/course-workspace.tsx`

The topic creation `Input` has localized placeholder text but no persistent, purpose-specific programmatic label through `<Label>`, `aria-label`, or `aria-labelledby`.

Impact: the control purpose depends on fallback text rather than an explicit stable label.

### Upload-topic selector

File: `src/components/course-workspace.tsx`

The upload-topic `SelectTrigger` has no associated `<Label>`, `aria-label`, or `aria-labelledby` describing that it selects the destination topic for newly uploaded material.

Impact: the displayed selected value does not consistently describe the control purpose.

## Confirmed structural gaps requiring runtime validation

### Mixed-direction study content

File: `src/components/course-workspace.tsx`

Editable topic titles and the course description already opt into `dir="auto"`, but extracted chunk titles/text and linked material titles render without an explicit direction boundary.

Observed structural risk: Hebrew source text inside the LTR Russian/English shell can inherit the surrounding page direction. The actual readability impact for mixed Hebrew, Russian, English, punctuation, and numbers has not yet been demonstrated with a browser fixture.

Smallest bounded validation/fix: add a targeted Hebrew mixed-content fixture or browser check; if it reproduces the issue, add `dir="auto"` only to the affected user/source-authored wrappers without changing layout or copy.

## Verified non-findings

### AI draft dialog close-path structure

Files:

- `src/components/ai-generate-dialog-impl.tsx`
- `src/components/ai-draft-modal.tsx`
- `src/components/ui/dialog.tsx`

The representative AI generation flow renders through `AIDraftModal`, which uses the shared Radix `Dialog`, `DialogContent`, and `DialogTitle` primitives. Structural inspection confirms that close requests emitted through the dialog `onOpenChange` path and the visible cancel/close action converge on `requestClose`, preserving the unsaved-draft confirmation path.

No additional Escape or dialog-title blocker was confirmed structurally. Focus trapping, focus restoration, and keyboard behavior remain runtime-only evidence and are not claimed by this inventory step.

## Next bounded implementation

1. Add localized `aria-label` values to only the two confirmed CourseWorkspace controls.
2. Preserve layout, storage behavior, keyboard behavior, and visible copy.
3. Use the existing structural regression contract for both purpose-specific labels.
4. Run the structural contract and typecheck.
5. Run a targeted CourseWorkspace or topic-learning browser check, including a mixed Hebrew/Russian/English fixture before treating the bidi gap as a confirmed blocker.

## Exclusions

- no broad visual redesign;
- no repetition of completed AppShell accessibility coverage;
- no claim that S4-001 or the one-course pilot is complete;
- no provider-dependent validation.
