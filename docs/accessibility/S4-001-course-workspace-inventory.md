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

## Next bounded implementation

1. Add localized `aria-label` values to only these two controls.
2. Preserve layout, storage behavior, keyboard behavior, and visible copy.
3. Add a structural regression contract that checks both purpose-specific labels.
4. Run the structural contract, typecheck, and the existing targeted CourseWorkspace or topic-learning browser check if available.

## Exclusions

- no broad visual redesign;
- no repetition of completed AppShell accessibility coverage;
- no claim that S4-001 or the one-course pilot is complete;
- no provider-dependent validation.
