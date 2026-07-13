# Lamdan implementation plans

This file records only the active or most recently completed implementation plan. Product intent remains in `ROADMAP.md`; task acceptance criteria remain in `TASKS.md`.

## P0-022C — Full Visual Backup and Restore

**Status:** in progress.

### Boundaries

- Keep the existing localStorage schema and legacy JSON format compatible.
- Preserve P0-022A's separate original, recipe and derived-preview records, and P0-022B's source-bound editable OCR drafts.
- Do not add multi-page image support, cloud sync or new OCR behavior in this task.

### Delivery plan

1. Add pure text parsing/snapshot helpers and one-transaction visual snapshot replace support for safe rollback. ✓
2. Create a versioned, checksummed ZIP service with manifest validation before any storage mutation. ✓
3. Add a clear Data page flow for lightweight JSON versus full ZIP, verification preview, merge, replace and cancellation. ✓
4. Add a permanent contract plus CI/check wiring, update the operational documents, then run all quality gates and a browser interaction pass where available.
