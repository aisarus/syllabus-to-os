# Lamdan implementation plans

This file records only the active or most recently completed implementation plan. Product intent remains in `ROADMAP.md`; task acceptance criteria remain in `TASKS.md`.

## P0-022B — OCR Region Overlay and Sync

**Status:** complete — local `npm run check` and PR #29 CI passed.

### Boundaries

- Keep P0-022A's immutable original, serializable recipe and one-current-derived-preview model intact.
- Change only the editable OCR draft and its source identity; do not auto-apply OCR text to a material.
- Do not attempt multi-page images or full visual backup in this task.

### Delivery plan

1. Add an explicit exact-raster context to every newly created OCR draft and resolve it safely after reload.
2. Add normalized-coordinate helpers and a responsive overlay that transforms the image and regions together.
3. Link text and image selection/hover, and add manual draw, move, resize, confirmed delete and keyboard access.
4. Add a permanent contract plus CI/check wiring, then run all quality gates and a browser interaction pass where available. ✓
