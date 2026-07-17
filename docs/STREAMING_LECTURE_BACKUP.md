# Streaming lecture backup — P1-010C3

## Product outcome

A student can export one complete long-media material directly to a user-selected file without first assembling the multi-gigabyte recording in JavaScript memory. The bundle includes the core material record, local media manifest, raw IndexedDB chunks, editable transcript draft, automatic provider candidate, resumable range queue and locally extracted range clips.

## Format

The first portable format is `lamdan-lecture-backup` version 1 with the extension `.lamdan-lecture`.

The file contains:

1. a fixed magic signature;
2. one length-prefixed JSON bundle manifest;
3. deterministic length-prefixed records;
4. each record payload written immediately after its JSON header.

Every descriptor includes an id, kind, byte size and SHA-256. Raw lecture chunks retain their stored chunk identity and are re-hashed before planning. During export every source record is loaded again, checked against the prepared descriptor, and then written to the native file stream.

## Streaming and memory boundary

- Lamdan requires the native Save File picker and writes through a `FileSystemWritableFileStream`-compatible target.
- The complete lecture is never reconstructed as one Blob or ArrayBuffer for backup.
- Raw media is fetched one existing IndexedDB chunk at a time. The current chunk is at most the long-media chunk boundary (8 MB).
- Local provider clips are fetched one range at a time. Their size remains bounded by the provider request limit.
- JSON companion records remain small and are encoded independently.
- SHA-256 checks may allocate one bounded record buffer, never the complete lecture.
- Cancellation aborts the writable stream rather than publishing an apparently complete bundle.

## Source integrity

- Preparation rejects incomplete or hash-mismatched raw chunks.
- Transcript drafts, automatic jobs, resumable jobs and local clips must match the active `sourceUploadId`.
- Export re-checks every prepared hash before writing its payload.
- Export verifies that the active lecture upload is unchanged before the first record and after the final record.
- Duplicate record ids, invalid hashes, invalid sizes and mismatched byte totals are rejected.
- The incremental inspector validates the manifest, record order, record sizes, every SHA-256 and trailing bytes without loading the complete file.

## Trust boundary

Export is local and performs no provider request. Provider text remains a candidate or editable draft exactly as stored. Export never approves transcript blocks, creates source chunks, or changes application state.

## Browser boundary

The production UI intentionally exposes streaming export only when the native Save File picker is available. It does not silently fall back to a JSZip or Blob download that could duplicate a multi-gigabyte lecture in memory. Current desktop Chromium is the supported browser for this slice.

## Next slice

P1-010C4 will use the same framed format and incremental inspector for staged restore. Import must write raw chunks under a staging upload identity, verify the complete archive, and only then atomically publish the restored manifest and companion records.
