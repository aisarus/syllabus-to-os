# Lamdan implementation plans

This file records only the active or most recently completed implementation plan. Product intent remains in `ROADMAP.md`; task acceptance criteria remain in `TASKS.md`.

## P0-022A — Image Preprocessing Workspace

**Status:** implementation complete; verification and PR preparation in progress.

### Boundaries

- Preserve the immutable original image and the existing OCR review/apply workflow.
- Do not add multi-page materials, OCR region editing or visual backups in this change; those are separate tasks.
- Keep the stored recipe serializable and versioned, with no unbounded history of derived blobs.

### Delivery plan

1. Upgrade the visual IndexedDB schema additively with separate processing-state and derived-image stores.
2. Implement a versioned recipe plus Worker-backed crop/rotation/deskew/pixel renderer and a bounded fallback.
3. Add a responsive preprocessing surface to the material OCR view, including visible source selection and reset.
4. Route OCR through the selected durable blob and fail back to the original if the derived cache is stale or absent.
5. Add a permanent contract and CI step, run `npm run check`, then open and merge a green PR.
