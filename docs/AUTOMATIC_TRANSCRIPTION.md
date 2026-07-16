# Reviewed automatic transcription

## Product outcome

Lamdan can send one explicitly selected provider-ready audio/video copy for transcription, preserve the returned timestamped text as a separate local candidate, and load it into the existing transcript editor only as an unapproved draft.

This slice is intentionally narrower than “upload any multi-gigabyte lecture and forget about it”. The locally stored original may be as large as 4 GB, but one provider request is bounded to **24 MB** so Lamdan stays below the provider’s current 25 MB audio-upload boundary. When the original is larger or unsupported, the user selects a separate compressed copy of the same complete lecture. The local original is not uploaded in that case.

## Explicit consent

No provider request occurs during:

- material navigation;
- local IndexedDB storage;
- player reconstruction;
- SHA-256 integrity checking;
- manual SRT/VTT/TXT import;
- ordinary transcript editing.

Immediately before upload, the UI names:

- the external provider;
- the selected model;
- the exact file name;
- the exact file size;
- whether the local original or a separate provider copy will be sent;
- the deployment disclosure for provider handling.

The upload button remains disabled until the consent checkbox is selected.

## Provider boundary

The current optional provider is **OpenAI Audio Transcriptions**. Credentials remain server-side in `OPENAI_API_KEY`; Lamdan never stores that key in localStorage, IndexedDB, an automatic-transcription job or the request payload returned to the browser.

Default models:

- `whisper-1` for timestamped segment JSON without speaker diarization;
- `gpt-4o-transcribe-diarize` when speaker labels are requested.

Deployments may override the endpoint and model names through server environment variables. When the provider is not configured, every local/manual long-media feature remains available.

## Untrusted candidate

Provider output is not written directly into the current editable transcript and is never written directly into `MaterialChunk` records. It is stored in a separate local IndexedDB job as an **Untrusted candidate** with:

- provider and model;
- source upload id;
- selected provider-copy metadata;
- request attempt count;
- cancellation/failure state;
- provider request id when available;
- timestamped segments;
- speaker labels;
- uncertainty warnings;
- visible uncovered time ranges.

A provider result tied to an older `sourceUploadId` is rejected after the lecture file is replaced.

## Review and apply sequence

1. User explicitly authorizes one upload.
2. Provider result becomes a local `review_ready` candidate.
3. User inspects segments, speakers, warnings and uncovered intervals.
4. User chooses “Load into editor as draft”.
5. Every loaded segment receives `status: "draft"`.
6. User edits text/time/speaker and manually changes chosen blocks to `approved`.
7. Only the existing separate Apply action converts approved, non-empty blocks into source chunks.

Loading a candidate does not alter already applied source chunks. Provider cancellation, failure or retry also leaves the current transcript and source chunks unchanged.

## Cancellation and retry

The browser can cancel an in-flight upload/request. A cancelled or interrupted job remains locally inspectable and can be retried. Attempt count survives reload. Provider secrets and media request bodies are not persisted by the Lamdan job store.

Cancellation is best-effort once a request reaches an external provider: Lamdan aborts its connection and ignores late output, but it cannot claim that an external provider instantly stops every internal operation.

## Persistence and backup boundary

Automatic-transcription jobs are a separate local IndexedDB layer. They survive reload and are included in the Data-page media-layer delete control and guarded orphan cleanup.

Workspace ZIP v2 does **not** yet contain:

- the raw multi-gigabyte recording;
- the editable long-media transcript draft;
- the automatic-transcription provider candidate.

Already applied transcript source chunks remain ordinary core workspace data and are included in the existing core backup.

## Current limitations

- A single automatic provider request accepts at most 24 MB.
- Lamdan does not yet transcode a large local recording itself.
- Resumable multi-part provider jobs for a 60–90 minute multi-gigabyte original remain a later slice.
- Speaker names are provider labels such as Speaker A/B unless the user edits them.
- Missing/unintelligible intervals remain visible; Lamdan does not fill them from model memory.
- Live provider quality is not considered verified until a configured deployment is tested with licensed real lecture audio.
