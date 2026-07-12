# Lamdan OCR, handwriting and photographed-math architecture

## Product requirement

Lamdan must eventually accept photographs of:

- printed pages;
- handwritten Hebrew notes;
- mixed Hebrew/Russian/English notes;
- whiteboards;
- mathematics solved step by step in a notebook;
- pages containing tables, diagrams and formulas.

The system must never treat an uncertain visual guess as clean source text.

## Required pipeline

```text
image upload
→ image validation and orientation
→ OCR/HTR provider
→ normalized OCR draft
→ region and confidence review
→ manual correction
→ save approved text and source regions as material chunks
→ downstream note/card/quiz generation
```

Live OCR is not connected by P0-020. This document and `src/lib/ocr-contract.ts` define the boundary for the next implementation task.

## Provider response contract

A provider should return one editable draft containing:

- full plain-text transcript;
- ordered regions;
- region kind: heading, paragraph, list, math, table, diagram or unknown;
- page number;
- bounding box in image coordinates;
- detected language;
- region confidence;
- uncertain tokens;
- warnings;
- normalized math expression when a region contains mathematics;
- overall confidence;
- explicit `requiresReview` state.

The normalization layer must tolerate malformed provider JSON and must not invent missing confidence, geometry or text.

## Handwriting rules

Handwritten content is HTR, not ordinary clean-document OCR. The review screen must assume that:

- letters may be ambiguous;
- word spacing may be unreliable;
- Hebrew cursive forms vary strongly between writers;
- line order can be unclear on crowded pages;
- arrows and side notes may alter reading order;
- mixed RTL/LTR text can reverse equations or variables.

Handwritten and whiteboard sources therefore default to manual review even when the provider reports high confidence.

## Mathematics rules

A photographed solution is not just a paragraph. The system must preserve:

- line order and intermediate steps;
- variables and case;
- operators and signs;
- exponents and subscripts;
- fractions, roots and parentheses;
- equality and inequality symbols;
- final answers;
- surrounding Hebrew instructions.

For every math region, Lamdan should keep both:

1. the visible transcription as the student wrote it;
2. a normalized expression such as LaTeX or a stable ASCII form.

The normalized form is used for comparison and evaluation. It must not silently replace the visible transcription.

## Confidence and abstention

The system must request review when any of the following is true:

- overall confidence is missing or below the product threshold;
- a region falls below the region threshold;
- the provider marks uncertain tokens;
- handwriting or whiteboard content is detected;
- mathematical symbols are ambiguous;
- text is empty despite a non-empty image;
- the provider returns warnings.

Unreadable content should produce an empty or partial draft with a warning. A confident invented equation is worse than no result.

## Persistence boundary

Until image/blob storage is implemented, Lamdan must not pretend that a photo can be retried after page reload. The future OCR intake task must add one of these explicitly:

- durable local blob storage such as IndexedDB; or
- server/object storage with a stable image id.

Only after the source image has a durable id should OCR regions be persisted with image coordinates.

## Privacy

Notebook photos can include names, phone numbers, student IDs, faces, lecturer material and copyrighted pages. Real benchmark assets stay private or licensed. The public repository stores only fixture metadata, ground truth and recorded candidate outputs.

## Evaluation gates

The OCR suite in `evals/manifest.json` measures:

- character error rate;
- word error rate;
- critical-token recall;
- math-expression recall;
- line order;
- hallucinated-token rate;
- honest review state;
- honest abstention on unreadable images.

A live OCR provider is not release-ready until it passes the private real-photo pack, not merely the recorded CI baselines.
