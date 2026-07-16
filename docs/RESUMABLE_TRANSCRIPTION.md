# Resumable range transcription — P1-010C1

## Product outcome

A student with a long lecture can plan exact, overlapping time ranges, attach a provider-ready media clip to any range, upload selected clips one at a time after explicit consent, retry or cancel ranges independently, and merge successful timestamped results into one unapproved transcript draft.

This slice removes the all-or-nothing provider request. It does **not** claim that the browser can already extract or transcode arbitrary clips from a 4 GB original.

## Range plan

- Default range length: 15 minutes.
- Default overlap: 2 seconds.
- Every range has an exact lecture start and end time.
- Adjacent overlap is intentional so speech crossing a cut is not silently lost.
- Exact duplicate overlap text is merged during candidate assembly.
- The complete plan and per-range state persist in a separate IndexedDB database.

## Explicit provider boundary

- No range file is uploaded while planning, navigating, playing media, checking SHA-256, or selecting a clip.
- Before upload the UI names the provider, model, number of selected files, range time and exact clip filename/size.
- Consent is kept only in the current browser view and resets when the queue or selected files change.
- Only the separately selected clips are uploaded. The complete local original is not substituted silently.
- Provider credentials stay server-side.

## Resumable state

Each range independently records:

- `needs_file`, `ready`, `uploading`, `processing`, `review_ready`, `cancelled` or `failed`;
- attempt count;
- selected clip metadata;
- upload progress;
- provider request id;
- timestamped result segments;
- warnings and errors.

A tab reload cannot recover an in-memory `File` object. Interrupted or merely selected ranges therefore return to `needs_file` and ask the student to select the clip again. Completed provider results remain available.

## Review and source integrity

- Returned timestamps are relative to the clip and are offset into the lecture timeline by the range start.
- Segments are clamped to the lecture duration.
- Failed, cancelled and unselected ranges remain visible as uncovered intervals.
- A successful range never erases another successful range.
- Provider results become one editable transcript only after **Load merged draft**.
- Every loaded segment has `status: draft`.
- No range result becomes a source chunk automatically.
- Existing applied source chunks remain unchanged until the ordinary transcript workspace is reviewed, approved and explicitly applied.
- A queue tied to an older `sourceUploadId` cannot load into a replaced lecture.

## Verification plan

The permanent gate covers the range contract, overlap/timestamp merge behavior, stale-upload rejection, interrupted-tab recovery, source-integrity boundaries, TypeScript, ESLint and the production build. Its Chromium scenario exercises two sequential range requests, one isolated provider failure, retry, overlap merge, draft-only loading and reload persistence while asserting that no source chunks are created automatically.

## Current boundary

P1-010C1 expects the student to provide valid provider-ready clips matching the displayed ranges. Automatic local audio extraction/transcoding is P1-010C2. Streaming backup for raw media, editable transcript drafts, single-request candidates and resumable queues is also still pending.
