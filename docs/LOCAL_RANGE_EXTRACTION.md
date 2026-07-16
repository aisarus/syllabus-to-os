# Local exact-range extraction — P1-010C2

## Product outcome

A student can turn an exact C1 lecture range into a provider-ready audio clip without uploading the original recording and without rebuilding a multi-gigabyte recording as one in-memory Blob.

The generated clip is persisted locally, attached to the existing revision-safe range queue and may be sent through the existing explicit-consent transcription provider flow. Provider text still loads only as an unapproved transcript draft.

**Implementation state:** integrated on PR #49; a normal connector head is running all final contracts, regressions and the real Chromium proof.

## IndexedDB streaming

The browser registers a same-origin Service Worker at `/long-media-stream-worker.js`.

For requests under `/__lamdan_media__/<materialId>?uploadId=<uploadId>` the worker:

- loads the active manifest from `lamdan-long-media`;
- rejects a stale `uploadId`;
- supports complete, explicit, open-ended and suffix HTTP byte ranges;
- returns `206`, `Content-Range`, `Content-Length` and `Accept-Ranges` for partial requests;
- reads only the required 8 MB IndexedDB chunks;
- slices at most the bytes needed from each chunk;
- closes the database when the stream completes, errors or is cancelled;
- returns `416` for invalid or out-of-bounds ranges;
- never assembles the complete recording in JavaScript memory.

## Exact real-time capture

For one persisted C1 range Lamdan:

1. verifies Service Worker, Web Audio and MediaRecorder capabilities;
2. shows expected wall time and approximate output size;
3. asks for an explicit local-extraction confirmation;
4. creates an audio/video element using the IndexedDB range-stream URL;
5. loads metadata and rejects a stale or shorter recording;
6. seeks to the exact range start;
7. routes the media element into a `MediaStreamAudioDestinationNode` without connecting it to speakers;
8. records the audio track through MediaRecorder at playback rate `1`;
9. stops at the exact range end;
10. rejects empty, prematurely stopped or clearly wrong-duration output;
11. persists the generated clip in `lamdan-range-extraction`;
12. attaches the clip metadata to the same C1 range queue.

Extraction is intentionally real-time. A 15-minute range takes roughly 15 minutes. The tab must remain active; background throttling or device sleep can invalidate the capture.

## Provider handoff

Locally extracted clips use the same C1 and P1-010B boundaries:

- the provider, model and clip count are shown before upload;
- a separate consent checkbox is required;
- clips are uploaded sequentially;
- the local original is never substituted silently;
- cancellation is persisted as cancellation, not provider failure;
- completed ranges survive another range failing;
- stale recording versions are rejected before send;
- merged output loads only with `status: "draft"`;
- source chunks remain unchanged until ordinary review and Apply.

## Persisted clip boundary

Generated clips live in a separate IndexedDB database and survive reloads. They are:

- keyed by material and range;
- tied to the exact `sourceUploadId`;
- deleted if the recording is replaced;
- included in guarded orphan cleanup;
- counted and removable on the Data page;
- not yet included in Workspace ZIP v2.

## Capability boundary

Local extraction is unavailable when the browser lacks a secure context, Service Workers, Web Audio, MediaRecorder or a supported audio output MIME. The UI shows the capability blocker instead of creating a fake or byte-sliced media file.

This first C2 slice targets browsers that can decode the stored lecture codec and record `audio/webm`, `audio/ogg` or `audio/mp4`. Codec compatibility must be verified by the browser during metadata load and capture.

## Verification plan

Before merge the permanent gate must prove:

- HTTP Range parsing and 416 behavior;
- exact wall-time and output-size estimates;
- TypeScript, ESLint, formatting and production build;
- a real Chromium WAV fixture stored as IndexedDB chunks;
- Service Worker `206` playback without complete-Blob reconstruction;
- exact local capture and persisted generated clip;
- provider mock handoff through the existing range queue;
- draft-only merge and reload persistence;
- zero automatic source chunks;
- existing long-media, automatic-transcription, resumable and Exam Engine regressions.
