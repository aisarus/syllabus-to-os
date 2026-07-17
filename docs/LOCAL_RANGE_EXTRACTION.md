# Local range extraction — P1-010C2

## Delivery status

Implemented on PR #52 after the merged P1-010C1 range-queue foundation in PR #48. Completion is gated on the dedicated contract, deterministic eval, TypeScript, lint, production build, local-extraction Chromium proof and the existing resumable-transcription Chromium regression.

## Product outcome

Lamdan can create an exact provider-ready audio clip for one persisted resumable-transcription range directly from the locally stored lecture. The original recording remains local. The generated clip is stored in IndexedDB, survives reload, and is uploaded only after the user gives explicit consent in the existing provider disclosure surface.

## Browser strategy

The first bounded implementation uses browser-native media APIs:

1. Reconstruct the stored lecture as a Blob from its existing IndexedDB chunks without converting the complete source into one ArrayBuffer.
2. Load that Blob into a local audio or video element.
3. Seek to the exact persisted range start.
4. Route decoded audio through Web Audio into a `MediaStreamDestination`.
5. Encode audio with `MediaRecorder` at normal playback speed in a supported Opus container.
6. Stop at the exact persisted range end.
7. Validate clip duration, MIME type, byte size, source upload identity and provider size boundary.
8. Persist the clip under `materialId + rangeId` in the resumable-transcription IndexedDB database.

Extraction therefore runs in real time. A fifteen-minute range takes approximately fifteen minutes, and the tab must remain open. It is cancellable and reports progress based on the source timeline.

## Resource estimates

Before work begins, the UI reports:

- expected real-time processing duration;
- estimated encoded output size at the bounded audio bitrate;
- temporary storage estimate;
- bounded working-memory estimate.

The implementation records only audio. It does not preserve video frames in provider clips.

## Trust and integrity boundaries

- Planning, local extraction, storage and reload do not upload the original or generated clip.
- Provider upload still requires explicit consent naming provider, model and prepared file count.
- Every clip is tied to the queue's `sourceUploadId`, exact range start and exact range end.
- A replaced lecture invalidates stale clips and queues.
- Clip validation must pass before the file is attached to a provider range.
- Provider output remains an unapproved draft and cannot create source chunks automatically.
- Cancellation or extraction failure cannot remove completed provider ranges.
- Manual provider-ready file selection remains available when browser extraction is unsupported or unsuitable.

## Current limitation

Browser-native extraction decodes the source through the media element and encodes in real time. It avoids one complete source ArrayBuffer, but browser media implementations may still use internal buffering. Faster-than-real-time demuxing/transcoding would require a separately audited WASM media pipeline and is not claimed by this slice.
