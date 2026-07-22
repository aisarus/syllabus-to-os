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

### Mixed-direction study content

File: `src/components/course-workspace.tsx`

Editable topic titles and the course description already opt into `dir="auto"`, but extracted chunk titles/text and linked material titles render without an explicit direction boundary.

Impact: Hebrew source text embedded in the LTR Russian/English shell can inherit the page direction, making mixed Hebrew, Russian, English, punctuation, and numbers less predictable to read.

Smallest bounded fix: add `dir="auto"` only to the user/source-authored chunk title, chunk text, and material title wrappers without changing layout or copy.

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
2. Add `dir="auto"` to only the confirmed chunk-title, chunk-text, and material-title wrappers.
3. Preserve layout, storage behavior, keyboard behavior, and visible copy.
4. Use or extend the existing structural regression contract for these exact markers.
5. Run the structural contract, typecheck, and the existing targeted CourseWorkspace or topic-learning browser check if available.

## Exclusions

- no broad visual redesign;
- no repetition of completed AppShell accessibility coverage;
- no claim that S4-001 or the one-course pilot is complete;
- no provider-dependent validation.
