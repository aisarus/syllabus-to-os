# Durable whole-lecture audio/video architecture

## Product goal

Lamdan must accept one complete lecture recording instead of requiring the user to cut a class into small files first. The first delivered slice is deliberately provider-independent: it stores the original audio/video locally, supports playback after reload, imports or edits a timestamped transcript, and turns only human-approved transcript blocks into normal Lamdan source chunks.

Automatic transcription is a separate follow-up. Selecting a recording never sends it to an external service implicitly.

## Chunked local storage

Long recordings do not use the ordinary document intake queue. That queue is designed for text extraction and may read a complete file in memory. Whole-lecture media uses the separate IndexedDB database `lamdan-long-media`:

- `manifests` stores one active manifest per material;
- `chunks` stores ordered 8 MB blobs under `[uploadId, index]`;
- `transcripts` stores the editable timestamped transcript draft;
- each media chunk records its SHA-256 digest;
- the explicit per-file limit is 4 GB;
- available browser quota is checked before the first chunk is written;
- persistent browser storage is requested on a best-effort basis.

The implementation slices the browser `File` object and writes one chunk at a time. It never calls `file.arrayBuffer()` for the complete recording.

## Atomic replacement and cancellation

A new or replacement recording gets a fresh staging `uploadId`.

1. Every chunk is written under the staging id.
2. The active manifest is changed only after all chunks have been saved.
3. Only then are chunks belonging to the previous upload removed.
4. Cancellation, quota failure, hashing failure or IndexedDB failure removes the staging chunks.
5. A previous complete recording remains active after a failed replacement.
6. A successful replacement invalidates the old transcript draft because its timestamps and wording may no longer match the source.

This is atomic at the manifest boundary. It avoids presenting a partially uploaded lecture as a valid source.

## Playback after reload

The upload page does not keep the original browser `File` reference. The detail workspace can reconstruct a `Blob` from ordered IndexedDB chunks and create a local object URL for an `<audio>` or `<video>` player.

Player reconstruction is explicit through **Load player**. This prevents a multi-gigabyte recording from being assembled in memory automatically on every route visit. Very large video may still require significant browser memory when playback is loaded; the UI states this boundary.

## Review before apply

The media recording itself is not immediately searchable study text.

A transcript can be created in either of two ways:

- create editable ten-minute placeholder blocks after media duration is known;
- import SRT, WebVTT or plain text.

Every transcript segment retains:

- start and end time;
- editable text;
- optional speaker label;
- `empty`, `draft` or `approved` status.

Only non-empty `approved` segments are converted into `MaterialChunk` records. Each applied chunk receives a visible time-range title and a section marker such as `lecture-transcript:600-1200`. Draft or unchecked text never becomes a trusted Lamdan source.

Applying a reviewed transcript uses the existing source-integrity-aware material-chunk replacement path. Notes, cards, quizzes, concepts and other source-linked outputs can then cite the approved lecture segments exactly like approved PDF or OCR chunks.

## Integrity and lifecycle

The material workspace can recompute every stored chunk SHA-256 and compare the result with the manifest records. Missing chunks, changed bytes or total-size mismatch fail the integrity check.

A mounted lifecycle prunes manifests, chunks and transcript drafts whose material no longer exists in the canonical core store. Data Management also exposes long-media size/count statistics and an explicit action for deleting recordings without deleting already applied core transcript chunks.

## Raw-media backup boundary

Workspace ZIP v2 is currently based on JSZip and is intentionally bounded. It is not a streaming archive path for multi-gigabyte recordings.

Therefore the current ZIP contains:

- the core material metadata;
- any transcript text that the user already approved and applied as source chunks;
- all other existing Workspace ZIP v2 layers.

It does **not** currently contain:

- the raw long audio/video chunks;
- the editable long-media transcript draft.

The Data page and lecture upload page state this boundary explicitly. Users must keep the original media file separately until a future streaming backup format is implemented.

## Privacy boundary

Choosing, storing, playing, importing a transcript or editing transcript blocks is fully local. No audio/video is sent to AI automatically.

A future reviewed transcription workflow must preserve these rules:

- explicit user action and provider disclosure before upload;
- cancellable and resumable segment jobs;
- timestamps and uncertainty retained;
- provider output remains a draft;
- no transcript block becomes a source before explicit review/apply;
- partial success must survive without inventing missing sections.

## Verification

Permanent verification includes:

- deterministic file-type, size, segmentation, SRT/VTT and approved-only source tests;
- a contract that guards chunk size, staging replacement, quota check, SHA-256, transcript source binding, lifecycle cleanup and backup warnings;
- a Chromium flow that uploads a real 18 MB file into three IndexedDB chunks, verifies hashes, imports two SRT blocks, applies two source chunks and confirms all layers after reload.
