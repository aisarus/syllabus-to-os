import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  printHelp();
  process.exit(0);
}

const baseUrl = String(args["base-url"] || process.env.LAMDAN_BASE_URL || "").replace(/\/$/u, "");
const assetDir = resolve(String(args["asset-dir"] || "private-ocr-assets"));
const candidateDir = resolve(String(args["candidate-dir"] || "private-eval-candidates"));
const manifestPath = resolve(String(args.manifest || "evals/manifest.json"));
const locale = args.locale === "en" ? "en" : "ru";

if (!baseUrl) {
  throw new Error("Provide --base-url or LAMDAN_BASE_URL for a running Lamdan deployment/preview.");
}
if (!existsSync(assetDir)) {
  throw new Error(`Private OCR asset directory does not exist: ${assetDir}`);
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const fixtures = manifest.fixtures.filter(
  (fixture) => fixture.suite === "ocr" && fixture.kind === "ocr" && fixture.input?.assetId,
);
if (fixtures.length === 0) throw new Error("No OCR fixtures with assetId values were found.");

await mkdir(candidateDir, { recursive: true });
const assetFiles = await readdir(assetDir);
let failures = 0;

for (const fixture of fixtures) {
  const assetStem = String(fixture.input.assetId).replace(/^private:/u, "");
  const fileName = assetFiles.find((file) => file.replace(/\.[^.]+$/u, "") === assetStem);
  if (!fileName) {
    failures += 1;
    console.error(`✗ ${fixture.id}: missing private asset for ${fixture.input.assetId}`);
    continue;
  }

  const path = join(assetDir, fileName);
  const bytes = await readFile(path);
  const mimeType = imageMimeType(path);
  const imageDataUrl = `data:${mimeType};base64,${bytes.toString("base64")}`;
  const response = await fetch(`${baseUrl}/api/ai/ocr-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageDataUrl,
      sourceStyle: fixture.input.sourceStyle || "mixed",
      locale,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok || !payload.draft) {
    failures += 1;
    console.error(`✗ ${fixture.id}: ${payload.error || `HTTP ${response.status}`}`);
    continue;
  }

  const draft = payload.draft;
  const candidate = {
    transcript: String(draft.text || ""),
    lines:
      Array.isArray(draft.regions) && draft.regions.length > 0
        ? draft.regions.map((region) => String(region.text || "").trim()).filter(Boolean)
        : String(draft.text || "")
            .split(/\r?\n/u)
            .map((line) => line.trim())
            .filter(Boolean),
    mathExpressions: Array.isArray(draft.regions)
      ? draft.regions.map((region) => region.normalizedMath).filter(Boolean)
      : [],
    confidence: typeof draft.confidence === "number" ? draft.confidence : 0,
    requiresReview: draft.requiresReview === true,
    warnings: Array.from(new Set([...(draft.warnings || []), ...(payload.warnings || [])])).map(
      String,
    ),
    metadata: {
      model: payload.model || null,
      promptVersion: payload.promptVersion || draft.promptVersion || null,
      assetId: fixture.input.assetId,
      sourceStyle: fixture.input.sourceStyle || "mixed",
      generatedAt: new Date().toISOString(),
    },
  };
  await writeFile(
    join(candidateDir, `${fixture.id}.json`),
    `${JSON.stringify({ candidate }, null, 2)}\n`,
  );
  console.log(`✓ ${fixture.id} → ${fileName}`);
}

if (failures > 0) {
  throw new Error(`${failures} private OCR fixture(s) could not be generated.`);
}

const evaluation = spawnSync(
  process.execPath,
  [
    "scripts/run-evals.mjs",
    "--manifest",
    manifestPath,
    "--suite",
    "ocr",
    "--candidate-dir",
    candidateDir,
    "--require-external-candidates",
  ],
  { cwd: process.cwd(), stdio: "inherit" },
);
if (evaluation.error) throw evaluation.error;
if (evaluation.status !== 0) process.exit(evaluation.status ?? 1);

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--help" || value === "-h") parsed.help = true;
    else if (value.startsWith("--")) {
      const key = value.slice(2);
      const next = values[index + 1];
      if (!next || next.startsWith("--")) parsed[key] = true;
      else {
        parsed[key] = next;
        index += 1;
      }
    }
  }
  return parsed;
}

function imageMimeType(path) {
  const extension = extname(path).toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  throw new Error(`Unsupported private OCR image extension: ${extension}`);
}

function printHelp() {
  console.log(`Run Lamdan's connected OCR provider against the private evaluation pack.\n\nUsage:\n  npm run eval:ocr:live -- --base-url https://your-preview.example --asset-dir ./private-ocr-assets\n\nThe asset filenames must match the manifest asset ids, for example:\n  printed-hebrew-page-01.jpg\n  handwritten-hebrew-notes-01.jpg\n  handwritten-math-notebook-01.jpg\n  blurred-notebook-photo-01.jpg\n`);
}
