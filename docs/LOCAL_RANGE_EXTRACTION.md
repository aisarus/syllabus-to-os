# Local exact-range extraction — P1-010C2

## Product outcome

A student can turn an exact C1 lecture range into a provider-ready audio clip without uploading the original recording and without rebuilding a multi-gigabyte recording as one in-memory Blob.

The generated clip is persisted locally, attached to the existing revision-safe range queue and may be sent through the existing explicit-consent transcription provider flow. Provider text still loads only as an unapproved transcript draft.

**Implementation state:** integrated on PR #49; a normal connector head is running all final contracts, regressions and the real Chromium proof.

## Extraction strategies

Lamdan chooses the safest local strategy supported by the stored recording:

- uncompressed PCM WAV recordings use a fast exact-byte path: Lamdan reads the WAV header, calculates frame-aligned offsets, requests only the selected PCM bytes and writes a new valid WAV clip;
- WebM, M4A, MP4 and video recordings use the bounded real-time browser path through a media element, Web Audio and MediaRecorder;
- both paths read through the same IndexedDB-backed HTTP Range Service Worker;
- neither path reconstructs the complete multi-gigabyte recording as one JavaScript Blob;
- the real-time fallback uses playback rate `1`, a zero-gain audio sink and explicit timeouts for audio-clock start, playback, recorder finalization and cleanup.

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

For a compressed-audio or video C1 range Lamdan:

1. verifies Service Worker, Web Audio and MediaRecorder capabilities;
2. shows expected wall time and approximate output size;
3. asks for an explicit local-extraction confirmation;
4. creates a hidden audio/video element using the IndexedDB range-stream URL;
5. loads metadata and rejects a stale or shorter recording;
6. seeks to the exact range start;
7. routes the media element into a `MediaStreamAudioDestinationNode` and a zero-gain output sink;
8. records the audio track through MediaRecorder at playback rate `1`;
9. stops at the exact range end or a bounded finalization timeout;
10. rejects empty, prematurely stopped or clearly wrong-duration output;
11. persists the generated clip in `lamdan-range-extraction`;
12. attaches the clip metadata to the same C1 range queue.

Real-time fallback is intentionally real-time. A 15-minute compressed range takes roughly 15 minutes. The tab must remain active; background throttling or device sleep can invalidate the capture. PCM WAV extraction is normally much faster because it does not play the recording.

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

Local extraction is unavailable when the required browser capabilities or source codec are missing. The UI shows the capability blocker instead of creating a fake or arbitrary byte-sliced media file.

The direct strategy currently accepts standard PCM RIFF/WAVE files. Other WAV encodings fall back to the browser capture path when supported. The real-time strategy targets browsers that can decode the stored lecture codec and record `audio/webm`, `audio/ogg` or `audio/mp4`.

## Verification plan

Before merge the permanent gate must prove:

- HTTP Range parsing and 416 behavior;
- PCM WAV header parsing and frame-aligned byte selection;
- exact wall-time and output-size estimates;
- TypeScript, ESLint, formatting and production build;
- a real Chromium WAV fixture stored as IndexedDB chunks;
- Service Worker `206` reads without complete-Blob reconstruction;
- exact local WAV creation and persisted generated clip;
- provider mock handoff through the existing range queue;
- draft-only merge and reload persistence;
- zero automatic source chunks;
- existing long-media, automatic-transcription, resumable and Exam Engine regressions.
