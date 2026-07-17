# Private Hebrew/Russian lecture validation — P1-010C5

## Purpose

This gate measures transcription quality on legally usable Hebrew and Russian academic audio without committing audio, reference transcripts, candidates or generated reports.

The benchmark is offline. External transcription remains inside Lamdan's existing explicit-consent UI. The evaluator reads local evidence only after the user has reviewed and saved a candidate.

## Private directory

Create `private-lecture-assets/` and copy `evals/private-lecture-manifest.example.json` to `private-lecture-assets/manifest.json`.

For every fixture place three files beside the manifest:

- the legally usable audio file;
- an exact human reference transcript;
- a candidate JSON file copied from the reviewed transcription result.

`private-lecture-assets/` and `private-eval-reports/` are gitignored. Do not commit private media, transcripts, candidates or reports.

## Candidate fields

A candidate uses format `lamdan-private-lecture-candidate`, version `1`, and contains:

- provider and model labels;
- optional request id and generation timestamp;
- measured end-to-end `latencyMs`;
- optional USD-per-audio-minute estimate;
- warnings;
- timestamped segments with text, optional speaker, language, uncertainty and issues.

Cost is an estimate from audio duration and the supplied rate. It is not provider billing truth.

## Run

```bash
npm run eval:lecture:private -- \
  --manifest private-lecture-assets/manifest.json \
  --require-languages he,ru
```

To isolate fixtures:

```bash
npm run eval:lecture:private -- \
  --manifest private-lecture-assets/manifest.json \
  --fixture he-academic-lecture-01
```

The command writes timestamped JSON and Markdown reports to `private-eval-reports/` and exits non-zero when any explicit fixture threshold fails.

## Metrics

- word error rate after Unicode normalization;
- character error rate;
- Hebrew niqqud-insensitive comparison;
- overlap-aware timestamp coverage;
- invalid or out-of-duration timestamps;
- speaker-label coverage when diarization was requested;
- uncertain-segment ratio;
- end-to-end latency;
- real-time factor (`latency / audio duration`);
- estimated cost from an explicitly supplied rate.

## Acceptance boundary

A full P1-010C5 run must include at least one Hebrew and one Russian fixture, explicit per-fixture thresholds, legally usable audio, exact human references, and candidates produced through the same Lamdan deployment under evaluation.

The harness makes no network request, approves no transcript, creates no source chunk and commits no private evidence. Passing synthetic metric tests proves the evaluator, not real transcription quality. Live quality remains externally blocked until private fixtures are supplied and the generated report is manually reviewed.
