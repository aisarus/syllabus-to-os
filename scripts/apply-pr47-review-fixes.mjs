import { readFile, writeFile } from "node:fs/promises";

async function replaceOnce(path, before, after) {
  const source = await readFile(path, "utf8");
  if (!source.includes(before)) {
    throw new Error(`${path}: expected review-fix anchor was not found`);
  }
  await writeFile(path, source.replace(before, after), "utf8");
}

await replaceOnce(
  "src/components/automatic-transcription-panel.tsx",
  `  useEffect(() => {
    let cancelled = false;
    setLoading(true);`,
  `  useEffect(() => {
    let cancelled = false;
    setManifest(undefined);
    setProviderStatus(undefined);
    setJob(undefined);
    setProviderCopy(null);
    setConsent(false);
    setUploadProgress(0);
    setLoading(true);`,
);

await replaceOnce(
  "src/components/automatic-transcription-panel.tsx",
  `                onChange={(event) => setRequestSpeakerLabels(event.target.checked)}`,
  `                onChange={(event) => {
                  const nextRequestSpeakerLabels = event.target.checked;
                  const nextModel = nextRequestSpeakerLabels
                    ? (models?.speakerModel ?? providerStatus?.model)
                    : (models?.plainModel ?? providerStatus?.model);
                  if (nextModel !== selectedModel) setConsent(false);
                  setRequestSpeakerLabels(nextRequestSpeakerLabels);
                }}`,
);

await replaceOnce(
  "src/routes/app.materials_.$materialId.tsx",
  `            <AutomaticTranscriptionPanel
              material={material}`,
  `            <AutomaticTranscriptionPanel
              key={material.id}
              material={material}`,
);

await replaceOnce(
  "src/lib/automatic-transcription.ts",
  `    .map((segment, index) => {
      const startSeconds = Math.max(0, Number(segment.startSeconds) || 0);
      const rawEnd = Number(segment.endSeconds);`,
  `    .map((segment, index) => {
      const rawStart = Math.max(0, Number(segment.startSeconds) || 0);
      const startSeconds = maxDuration ? Math.min(maxDuration, rawStart) : rawStart;
      const rawEnd = Number(segment.endSeconds);`,
);

await replaceOnce(
  "src/lib/automatic-transcription.ts",
  `        endSeconds: Math.max(startSeconds + 0.01, boundedEnd),`,
  `        endSeconds: boundedEnd,`,
);

await replaceOnce(
  "src/lib/automatic-transcription.ts",
  `    .filter((segment) => segment.text && segment.endSeconds > segment.startSeconds)`,
  `    .filter(
      (segment) =>
        segment.text &&
        segment.endSeconds > segment.startSeconds &&
        (!maxDuration || segment.startSeconds < maxDuration),
    )`,
);

await replaceOnce(
  "src/lib/server/automatic-transcription-provider.ts",
  `      \`Provider-ready media must be smaller than \${Math.floor(MAX_AUTOMATIC_TRANSCRIPTION_BYTES / 1024 / 1024) + 1} MB.\`,`,
  `      \`Provider-ready media must be \${Math.floor(MAX_AUTOMATIC_TRANSCRIPTION_BYTES / 1024 / 1024)} MB or smaller.\`,`,
);

await replaceOnce(
  "scripts/run-automatic-transcription-browser-e2e.mjs",
  `        request.onblocked = () => resolve();
      });
      await new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase("lamdan-automatic-transcription");
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        request.onblocked = () => resolve();`,
  `        request.onblocked = () =>
          reject(new Error("lamdan-long-media deletion was blocked"));
      });
      await new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase("lamdan-automatic-transcription");
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        request.onblocked = () =>
          reject(new Error("lamdan-automatic-transcription deletion was blocked"));`,
);

await replaceOnce(
  "scripts/run-automatic-transcription-evals.mjs",
  `assert.deepEqual(
  normalized[0].issues,
  ["Low confidence"],
  "duplicate provider quality warnings must be collapsed",
);

const gaps = findAutomaticTranscriptionGaps(normalized, 120, 8);`,
  `assert.deepEqual(
  normalized[0].issues,
  ["Low confidence"],
  "duplicate provider quality warnings must be collapsed",
);

const durationBounded = normalizeAutomaticSegments(
  [
    {
      id: "near-end",
      startSeconds: 119.999,
      endSeconds: 130,
      text: "brief final fragment",
    },
    {
      id: "outside",
      startSeconds: 120,
      endSeconds: 125,
      text: "must be dropped",
    },
  ],
  120,
);
assert.equal(durationBounded.length, 1, "segments starting at the media end must be dropped");
assert.equal(
  durationBounded[0].endSeconds,
  120,
  "normalized timestamps must never exceed the media duration",
);

const gaps = findAutomaticTranscriptionGaps(normalized, 120, 8);`,
);

await replaceOnce(
  "scripts/verify-automatic-transcription-contract.mjs",
  `  'body.set("file"',
]) {`,
  `  'body.set("file"',
  "segment.startSeconds < maxDuration",
  "endSeconds: boundedEnd",
]) {`,
);

await replaceOnce(
  "scripts/verify-automatic-transcription-contract.mjs",
  `  "no usable speech segments",
]) {`,
  `  "no usable speech segments",
  "MB or smaller",
]) {`,
);

await replaceOnce(
  "scripts/verify-automatic-transcription-contract.mjs",
  `  "window.confirm",
]) {`,
  `  "window.confirm",
  "setProviderCopy(null)",
  "if (nextModel !== selectedModel) setConsent(false)",
]) {`,
);

await replaceOnce(
  "scripts/verify-automatic-transcription-contract.mjs",
  `  "<LongMediaWorkspace",
]) {`,
  `  "<LongMediaWorkspace",
  "key={material.id}",
]) {`,
);

await replaceOnce(
  "scripts/verify-automatic-transcription-contract.mjs",
  `  "Reviewed automatic transcription browser E2E passed",
]) {`,
  `  "Reviewed automatic transcription browser E2E passed",
  "lamdan-long-media deletion was blocked",
  "lamdan-automatic-transcription deletion was blocked",
]) {`,
);

await replaceOnce(
  "scripts/verify-automatic-transcription-contract.mjs",
  `  "missing or unintelligible intervals must remain visible",
  "provider output may never become approved source evidence automatically",`,
  `  "missing or unintelligible intervals must remain visible",
  "normalized timestamps must never exceed the media duration",
  "provider output may never become approved source evidence automatically",`,
);

console.log("PR #47 review fixes applied.");
