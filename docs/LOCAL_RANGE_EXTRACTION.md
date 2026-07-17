# Local range extraction — P1-010C2

**Status:** active delivery. The implementation is deliberately browser-capability bounded; it does not claim a universal transcoder.

## Product outcome

For a persisted lecture range, Lamdan can explicitly create an audio/WebM provider copy from the local source before any provider upload is considered. The original recording stays inside the browser. The generated clip is then attached to the existing C1 queue as a normal provider-ready file, so the existing disclosure, consent, cancellation, retry and review boundaries continue to apply.

## Local-only capture path

1. The UI checks for media-element capture, `MediaRecorder` and an audio/WebM recorder MIME type.
2. It shows a conservative output-size estimate, temporary-storage estimate and normal-speed wall-time estimate before the student confirms extraction.
3. The stored source is reconstructed as ordered `Blob` parts; C2 does not call `arrayBuffer()` on the complete original recording.
4. A new hidden media element seeks to the persisted range boundary and must remain at playback rate `1`.
5. Only the captured audio track is recorded. Recorder events are saved incrementally in the dedicated `lamdan-local-range-extraction` IndexedDB database under a staging clip id.
6. Cancellation or failure deletes that staging clip and cannot replace a previously ready range.
7. Before promotion, the clip must match the exact material/upload/range identity, have duration evidence within tolerance, use `audio/webm`, fit the provider byte limit and pass the normal provider-file validation. Lamdan prefers parsed WebM duration; if Chromium leaves no finite value after a local metadata probe, it may use only the independently observed 1× source-playback span—not the requested range itself.
8. Only then does Lamdan mark the C1 range `ready`. No consent is recorded and no upload occurs during extraction.

## Honest browser boundary

`captureStream` and recorder support vary by browser and media codec. An unavailable capture API, missing audio track, imprecise seek, changed playback rate, source ending early, recorder failure, absent duration evidence or size/MIME/timing mismatch are explicit failures. The manual C1 **Choose clip** action stays available in all of those cases.

The failure is kept on the exact range row, not only in a transient notification. A failed replacement never removes a previously ready clip.

Local capture runs at normal playback speed so it does not silently shift timestamps. A 15-minute range can take about 15 minutes to capture. The browser generally cannot provide actual CPU time; Lamdan records wall time and, when the browser exposes Long Tasks, main-thread busy milliseconds instead of inventing a CPU metric.

## Persistence and recovery

- Recorder output is chunked incrementally while `staging` and promoted to `ready` only after validation.
- A completed local clip can be rebuilt as a browser `File` after reload, so an interrupted provider upload recovers to `ready` and requires new visible consent.
- A manually selected replacement clears the local-extraction provenance.
- Deleting the range queue deletes its local extracted clips as well.
- Raw originals and local clips are still outside Workspace ZIP v2; streaming backup is a later P1-010C task.

## Verification

The permanent contract checks the local-only API boundary, staged storage, strict promotion, C1 attachment and manual fallback. Deterministic evaluations cover capability detection, conservative estimates, range identity, timing, MIME, provider size, persisted recovery and manual replacement. Chromium covers a real two-second WAV capture, chunk persistence, local WebM promotion, mocked provider result, draft-only merge and reload with zero automatic source chunks.
