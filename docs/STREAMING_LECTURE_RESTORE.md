# Staged streaming lecture restore — P1-010C4

## Product outcome

A student can select a verified `.lamdan-lecture` file and restore it as a new independent long-media material. Existing materials are never overwritten by this slice.

## Restore sequence

1. Verify the fixed file signature, bundle manifest, deterministic record order, byte sizes, every SHA-256 and exact EOF.
2. Read the core material and long-media manifest only after their checksums pass.
3. Allocate a new `materialId` and a new local `uploadId`.
4. Stage raw media chunks one at a time under the new identities without publishing a long-media manifest.
5. Stage local range clips under the new identities.
6. Confirm that source media chunk indexes, count and total bytes match the archived media manifest.
7. Publish the long-media manifest only after every archive record has been consumed and verified.
8. Publish the rewritten transcript draft, automatic provider candidate and resumable queue.
9. Add the core material to the visible library last.

## Rollback boundary

Any checksum mismatch, truncated frame, stale source identity, IndexedDB failure, cancellation or publication failure removes:

- staged raw chunks;
- a partially published media manifest and transcript;
- the automatic transcription job;
- the resumable queue and local clips;
- the visible core material, if it was published.

The imported material is therefore either visible with all verified companion records or absent after cleanup.

## Identity and conflict policy

P1-010C4 always restores as a duplicate. It does not replace a material with the archived `materialId`, and it clears archived course/topic links because those workspace entities may not exist in the destination. The archived provider text remains a candidate or draft; restore does not approve transcript blocks or create source chunks.

## Streaming and memory boundary

The browser uses Blob slices and processes one framed payload at a time. Raw media payloads remain bounded by the archived long-media chunk size. Local clips remain bounded by the provider clip limit. The complete lecture is never converted into one ArrayBuffer during restore.

## Review boundary

The Data page shows the source file, raw chunk count, local clip count and included companion layers before restore. The user may rename the duplicate. Progress distinguishes verification, staging, publication and rollback.
