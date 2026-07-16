import { readFile, writeFile } from "node:fs/promises";

async function replaceOnce(path, before, after) {
  const source = await readFile(path, "utf8");
  if (source.includes(after)) return;
  if (!source.includes(before)) throw new Error(`${path}: ledger anchor was not found`);
  await writeFile(path, source.replace(before, after), "utf8");
}

await replaceOnce(
  "TASKS.md",
  `## P1-010 — Audio transcription review-and-apply

- **Status:** [ ]
- **Priority:** P1 after M1 validation
- **Size:** L
- **Depends on:** P1-008

### Non-negotiable boundaries

- timestamped source sections;
- no automatic trusted transcript;
- cancellation, timeout and retry;
- explicit language and speaker uncertainty;
- outputs retain transcript-section references.`,
  `## P1-010 — Audio transcription review-and-apply

- **Status:** [~]
- **Priority:** active P1 delivery
- **Size:** L
- **Depends on:** P1-010A durable long-media intake
- **Current PR:** #47

### Delivered in P1-010A / PR #46

- complete local audio/video storage in 8 MB IndexedDB chunks;
- 4 GB local boundary, quota check, cancellation and SHA-256 verification;
- local player, SRT/VTT/TXT import and editable timestamp blocks;
- only approved non-empty transcript blocks become source chunks;
- real 18 MB Chromium upload/apply/reload proof.

### Delivered in P1-010B / PR #47

- optional server-side OpenAI Audio Transcriptions provider;
- exact provider/model/file/size disclosure and explicit consent;
- 24 MB provider-request boundary and separate compressed provider-copy option;
- cancellation, retry, interrupted-tab recovery and persisted attempt count;
- separate local provider candidate with timestamps, speaker labels and uncertainty warnings;
- visible uncovered intervals instead of model-memory gap filling;
- stale source-upload rejection after recording replacement;
- candidate loads into the editor only with \`status: "draft"\`;
- current source chunks remain unchanged until manual review and Apply;
- consent resets across material/model changes;
- provider timestamps remain inside media duration;
- contract/evals and cancellation → retry → draft → reload Chromium proof.

### Remaining P1-010C work

- automatic local audio extraction/transcoding for originals above one provider request;
- resumable multi-part provider jobs and partial-range recovery;
- streaming backup for raw media, editable transcript drafts and provider candidates;
- live licensed Hebrew/Russian lecture quality, latency and cost validation.

### Non-negotiable boundaries

- no hidden upload during storage, navigation, playback or integrity checking;
- timestamped source sections;
- no automatic trusted transcript;
- cancellation, timeout and retry;
- explicit language and speaker uncertainty;
- missing intervals remain visible;
- outputs retain transcript-section references.`,
);

await replaceOnce(
  ".github/workflows/ci.yml",
  `      - name: Verify per-question evidence contract
        run: npm run verify:per-question-evidence-contract
`,
  `      - name: Verify per-question evidence contract
        run: npm run verify:per-question-evidence-contract
      - name: Verify automatic transcription contract
        run: npm run verify:automatic-transcription-contract
`,
);

await replaceOnce(
  ".github/workflows/ci.yml",
  `      - name: Run workspace backup v2 evaluations
        id: workspace_backup_eval
        continue-on-error: true
        run: npm run eval:workspace-backup 2>&1 | tee workspace-backup-eval-output.txt
`,
  `      - name: Run workspace backup v2 evaluations
        id: workspace_backup_eval
        continue-on-error: true
        run: npm run eval:workspace-backup 2>&1 | tee workspace-backup-eval-output.txt
      - name: Run automatic transcription evaluations
        run: npm run eval:automatic-transcription
`,
);

console.log("PR #47 canonical ledgers updated.");
