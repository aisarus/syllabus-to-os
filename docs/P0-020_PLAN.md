# P0-020 — Evaluation fixtures and OCR readiness plan

## Goal

Create a deterministic, offline evaluation system for the parts of Lamdan that can fail silently: syllabus structure, source grounding, multilingual preservation, OCR/handwriting transcription and handwritten mathematics.

This task does **not** claim that live OCR is already connected. It creates the contract, fixtures, metrics and provider boundary required to add OCR without guessing whether it works.

## Deliverables

1. A versioned evaluation manifest with positive baselines and deliberately bad negative controls.
2. Deterministic scorers for structured extraction, grounded generation, multilingual preservation and OCR.
3. OCR metrics that treat ordinary text and mathematics differently.
4. First-class OCR draft types with regions, confidence, uncertainty, reading order and math expressions.
5. Fixtures covering:
   - mixed Hebrew/Russian university syllabus data;
   - grounded note and quiz output;
   - Hebrew terminology preserved inside Russian explanation;
   - printed Hebrew page photo;
   - handwritten Hebrew page photo;
   - handwritten mathematics notebook photo;
   - low-quality unreadable photo where abstention is safer than hallucination.
6. Local and CI commands that fail when a baseline drops below explicit thresholds or a negative control incorrectly passes.
7. Documentation for adding private or licensed real-photo asset packs without committing personal notebooks to the public repository.

## OCR principles

- OCR/HTR output is always an editable draft.
- Low confidence must produce a review state, never fake certainty.
- The provider must preserve line/region order and image coordinates.
- Handwritten math must preserve variables, operators, exponents, fractions and intermediate steps.
- Plain text and normalized math/LaTeX are stored separately when available.
- Unreadable regions are marked as uncertain or omitted with a warning rather than invented.
- Real user photos are not committed to the public repository without explicit permission.

## Verification

- `npm run eval`
- `npm run verify:evaluation-fixtures`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
