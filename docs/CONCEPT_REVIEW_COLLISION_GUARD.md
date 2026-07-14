# Concept review collision guard

Reviewed concept candidates remain editable until acceptance, so duplicate detection must run twice:

1. while candidates are displayed, to show visible `invalid`, `duplicate_existing` and `duplicate_batch` reasons;
2. immediately before persistence, using the current edited titles, aliases and source links.

The final acceptance planner compares every normalized title and alias against:

- all existing concepts in the current course;
- every earlier valid candidate accepted from the same selected batch.

The first valid selected candidate wins. A later candidate with a colliding title or alias remains in the review queue for correction. Candidates with no still-valid approved source chunk are rejected as invalid.

This guard does not create learning evidence, infer concept relationships or silently delete rejected candidates.