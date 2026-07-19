import { readFile, writeFile } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");
const write = (path, content) =>
  writeFile(path, content.endsWith("\n") ? content : `${content}\n`, "utf8");

function replaceExact(content, before, after, label) {
  if (!content.includes(before)) throw new Error(`Patch anchor not found: ${label}`);
  return content.replace(before, after);
}

await write(
  "src/lib/intake-cancellation.ts",
  `export class IntakeCancelledError extends Error {
  constructor(message = "Material processing was cancelled.") {
    super(message);
    this.name = "AbortError";
  }
}

export function throwIfIntakeCancelled(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  const reason = signal.reason;
  if (reason instanceof Error && reason.name === "AbortError") throw reason;
  if (reason instanceof Error) throw new IntakeCancelledError(reason.message);
  throw new IntakeCancelledError();
}

export function isIntakeCancellation(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  return error instanceof Error && error.name === "AbortError";
}
`,
);

let fingerprints = await read("src/lib/material-fingerprints.ts");
fingerprints = replaceExact(
  fingerprints,
  `const KEY = "lamdan.material-fingerprints.v1";`,
  `import { throwIfIntakeCancelled } from "./intake-cancellation";\n\nconst KEY = "lamdan.material-fingerprints.v1";`,
  "fingerprint cancellation import",
);
fingerprints = replaceExact(
  fingerprints,
  `export async function fingerprintFile(file: File): Promise<string | undefined> {\n  if (typeof crypto === "undefined" || !crypto.subtle) return undefined;\n  const bytes = await file.arrayBuffer();\n  const digest = await crypto.subtle.digest("SHA-256", bytes);\n  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join(\n    "",\n  );\n}`,
  `export async function fingerprintFile(\n  file: File,\n  signal?: AbortSignal,\n): Promise<string | undefined> {\n  throwIfIntakeCancelled(signal);\n  if (typeof crypto === "undefined" || !crypto.subtle) return undefined;\n  const bytes = await file.arrayBuffer();\n  throwIfIntakeCancelled(signal);\n  const digest = await crypto.subtle.digest("SHA-256", bytes);\n  throwIfIntakeCancelled(signal);\n  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join(\n    "",\n  );\n}`,
  "fingerprint signal",
);
await write("src/lib/material-fingerprints.ts", fingerprints);

let documentIngestion = await read("src/lib/document-ingestion.ts");
documentIngestion = replaceExact(
  documentIngestion,
  `import type {\n  MaterialExtractionMethod,`,
  `import { isIntakeCancellation, throwIfIntakeCancelled } from "./intake-cancellation";\nimport type {\n  MaterialExtractionMethod,`,
  "document cancellation import",
);
documentIngestion = replaceExact(
  documentIngestion,
  `export async function ingestFile(file: File): Promise<IngestResult> {\n  const ext = (file.name.split(".").pop() || "").toLowerCase();`,
  `export async function ingestFile(file: File, signal?: AbortSignal): Promise<IngestResult> {\n  throwIfIntakeCancelled(signal);\n  const ext = (file.name.split(".").pop() || "").toLowerCase();`,
  "ingest signal signature",
);
documentIngestion = documentIngestion
  .replace(`const text = await readFileAsText(file);`, `const text = await readFileAsText(file, signal);`)
  .replace(`return await extractXlsx(file);`, `return await extractXlsx(file, signal);`)
  .replace(`return await extractDocx(file);`, `return await extractDocx(file, signal);`)
  .replace(`return await extractPdf(file);`, `return await extractPdf(file, signal);`);
documentIngestion = documentIngestion.replaceAll(
  `    } catch (e) {\n      return errorResult((e as Error).message);\n    }`,
  `    } catch (error) {\n      if (isIntakeCancellation(error, signal)) throw error;\n      return errorResult((error as Error).message);\n    }`,
);
documentIngestion = replaceExact(
  documentIngestion,
  `export function readFileAsText(file: File): Promise<string> {\n  return new Promise((resolve, reject) => {\n    const reader = new FileReader();\n    reader.onload = () => resolve(String(reader.result ?? ""));\n    reader.onerror = () => reject(reader.error);\n    reader.readAsText(file);\n  });\n}`,
  `export function readFileAsText(file: File, signal?: AbortSignal): Promise<string> {\n  return new Promise((resolve, reject) => {\n    try {\n      throwIfIntakeCancelled(signal);\n    } catch (error) {\n      reject(error);\n      return;\n    }\n\n    const reader = new FileReader();\n    const cleanup = () => signal?.removeEventListener("abort", abort);\n    const abort = () => reader.abort();\n    reader.onload = () => {\n      cleanup();\n      try {\n        throwIfIntakeCancelled(signal);\n        resolve(String(reader.result ?? ""));\n      } catch (error) {\n        reject(error);\n      }\n    };\n    reader.onerror = () => {\n      cleanup();\n      reject(reader.error);\n    };\n    reader.onabort = () => {\n      cleanup();\n      try {\n        throwIfIntakeCancelled(signal);\n      } catch (error) {\n        reject(error);\n        return;\n      }\n      reject(new Error("File reading was aborted."));\n    };\n    signal?.addEventListener("abort", abort, { once: true });\n    reader.readAsText(file);\n  });\n}`,
  "abortable text reader",
);
await write("src/lib/document-ingestion.ts", documentIngestion);

for (const [path, functionName] of [
  ["src/lib/ingestion/docx.ts", "extractDocx"],
  ["src/lib/ingestion/xlsx.ts", "extractXlsx"],
  ["src/lib/ingestion/pdf.ts", "extractPdf"],
]) {
  let content = await read(path);
  content = replaceExact(
    content,
    `import {`,
    `import { throwIfIntakeCancelled } from "../intake-cancellation";\nimport {`,
    `${functionName} cancellation import`,
  );
  content = replaceExact(
    content,
    `export async function ${functionName}(file: File): Promise<IngestResult> {`,
    `export async function ${functionName}(\n  file: File,\n  signal?: AbortSignal,\n): Promise<IngestResult> {\n  throwIfIntakeCancelled(signal);`,
    `${functionName} signal signature`,
  );
  content = content.replace(
    `const arrayBuffer = await file.arrayBuffer();`,
    `const arrayBuffer = await file.arrayBuffer();\n  throwIfIntakeCancelled(signal);`,
  );
  content = content.replace(
    `const buf = await file.arrayBuffer();`,
    `const buf = await file.arrayBuffer();\n  throwIfIntakeCancelled(signal);`,
  );
  content = content.replace(
    `const data = await file.arrayBuffer();`,
    `const data = await file.arrayBuffer();\n  throwIfIntakeCancelled(signal);`,
  );
  content = content.replace(
    `const result = await mammoth.extractRawText({ arrayBuffer });`,
    `const result = await mammoth.extractRawText({ arrayBuffer });\n  throwIfIntakeCancelled(signal);`,
  );
  content = content.replace(
    `const wb = XLSX.read(buf, { type: "array" });`,
    `const wb = XLSX.read(buf, { type: "array" });\n  throwIfIntakeCancelled(signal);`,
  );
  content = content.replace(
    `for (const name of wb.SheetNames) {`,
    `for (const name of wb.SheetNames) {\n    throwIfIntakeCancelled(signal);`,
  );
  content = content.replace(
    `const doc = await pdfjsLib.getDocument({ data }).promise;`,
    `const doc = await pdfjsLib.getDocument({ data }).promise;\n  throwIfIntakeCancelled(signal);`,
  );
  content = content.replace(
    `for (let p = 1; p <= pageCount; p++) {`,
    `for (let p = 1; p <= pageCount; p++) {\n    throwIfIntakeCancelled(signal);`,
  );
  content = content.replace(
    `const content = await page.getTextContent();`,
    `const content = await page.getTextContent();\n    throwIfIntakeCancelled(signal);`,
  );
  await write(path, content);
}

let materialIntake = await read("src/lib/material-intake.ts");
materialIntake = replaceExact(
  materialIntake,
  `import { ingestFile, ingestPastedText, type IngestResult } from "./document-ingestion";`,
  `import { ingestFile, ingestPastedText, type IngestResult } from "./document-ingestion";\nimport { throwIfIntakeCancelled } from "./intake-cancellation";`,
  "material intake cancellation import",
);
materialIntake = replaceExact(
  materialIntake,
  `export async function prepareFileIntake(file: File): Promise<PreparedFileIntake> {\n  const isVisualSource = isVisualSourceCandidate(file);\n  const extraction = isVisualSource ? prepareVisualExtraction(file) : await ingestFile(file);`,
  `export async function prepareFileIntake(\n  file: File,\n  options: { signal?: AbortSignal } = {},\n): Promise<PreparedFileIntake> {\n  throwIfIntakeCancelled(options.signal);\n  const isVisualSource = isVisualSourceCandidate(file);\n  const extraction = isVisualSource\n    ? prepareVisualExtraction(file)\n    : await ingestFile(file, options.signal);\n  throwIfIntakeCancelled(options.signal);`,
  "prepare intake signal",
);
await write("src/lib/material-intake.ts", materialIntake);

let queue = await read("src/components/material-intake-queue.tsx");
queue = replaceExact(
  queue,
  `import { formatFileSize } from "@/lib/document-ingestion";`,
  `import { formatFileSize } from "@/lib/document-ingestion";\nimport { isIntakeCancellation, throwIfIntakeCancelled } from "@/lib/intake-cancellation";`,
  "queue cancellation import",
);
queue = replaceExact(
  queue,
  `  const runningRef = useRef(new Set<string>());\n  const fingerprintsInFlightRef = useRef(new Map<string, string>());`,
  `  const runningRef = useRef(new Set<string>());\n  const abortControllersRef = useRef(new Map<string, AbortController>());\n  const fingerprintsInFlightRef = useRef(new Map<string, string>());`,
  "queue abort controller ref",
);
queue = replaceExact(
  queue,
  `  useEffect(() => {\n    dataRef.current = data;\n  }, [data]);`,
  `  useEffect(() => {\n    dataRef.current = data;\n  }, [data]);\n\n  useEffect(\n    () => () => {\n      abortControllersRef.current.forEach((controller) => controller.abort());\n      abortControllersRef.current.clear();\n    },\n    [],\n  );`,
  "queue unmount cancellation",
);
queue = replaceExact(
  queue,
  `    runningRef.current.add(id);\n    setItems((current) =>`,
  `    runningRef.current.add(id);\n    const controller = new AbortController();\n    abortControllersRef.current.set(id, controller);\n    const { signal } = controller;\n    setItems((current) =>`,
  "queue controller creation",
);
queue = queue.replace(
  `const fingerprint = item.fingerprint ?? (await fingerprintFile(item.file));`,
  `const fingerprint = item.fingerprint ?? (await fingerprintFile(item.file, signal));\n      throwIfIntakeCancelled(signal);`,
);
queue = queue.replace(
  `const prepared = item.prepared ?? (await prepareFileIntake(item.file));`,
  `const prepared = item.prepared ?? (await prepareFileIntake(item.file, { signal }));\n      throwIfIntakeCancelled(signal);`,
);
queue = queue.replace(
  `        if (exactDuplicate) {\n          pauseForDuplicate`,
  `        if (exactDuplicate) {\n          throwIfIntakeCancelled(signal);\n          pauseForDuplicate`,
);
queue = queue.replace(
  `        if (likelyDuplicate) {\n          pauseForDuplicate`,
  `        if (likelyDuplicate) {\n          throwIfIntakeCancelled(signal);\n          pauseForDuplicate`,
);
queue = queue.replace(
  `      setItems((current) =>\n        current.map((candidate) =>`,
  `      throwIfIntakeCancelled(signal);\n      setItems((current) =>\n        current.map((candidate) =>`,
);
queue = replaceExact(
  queue,
  `    } catch (error) {\n      setItems((current) =>\n        current.map((candidate) =>\n          candidate.id === id\n            ? {\n                ...candidate,\n                status: "error",\n                message: error instanceof Error ? error.message : String(error),\n              }\n            : candidate,\n        ),\n      );\n    } finally {\n      runningRef.current.delete(id);`,
  `    } catch (error) {\n      const cancelled = isIntakeCancellation(error, signal);\n      setItems((current) =>\n        current.map((candidate) =>\n          candidate.id === id\n            ? {\n                ...candidate,\n                status: cancelled ? "cancelled" : "error",\n                message: cancelled\n                  ? "Processing cancelled."\n                  : error instanceof Error\n                    ? error.message\n                    : String(error),\n                prepared: cancelled ? undefined : candidate.prepared,\n              }\n            : candidate,\n        ),\n      );\n    } finally {\n      abortControllersRef.current.delete(id);\n      runningRef.current.delete(id);`,
  "queue cancellation catch",
);
queue = replaceExact(
  queue,
  `  const cancel = useCallback((id: string) => {\n    setItems((current) =>\n      current.map((item) =>\n        item.id === id && item.status === "queued" ? { ...item, status: "cancelled" } : item,\n      ),\n    );\n  }, []);`,
  `  const cancel = useCallback((id: string) => {\n    abortControllersRef.current.get(id)?.abort();\n    setItems((current) =>\n      current.map((item) =>\n        item.id === id && (item.status === "queued" || item.status === "extracting")\n          ? { ...item, status: "cancelled", message: "Processing cancelled." }\n          : item,\n      ),\n    );\n  }, []);`,
  "queue running cancel",
);
await write("src/components/material-intake-queue.tsx", queue);

await write(
  "scripts/run-intake-cancellation-evals.mjs",
  `import assert from "node:assert/strict";
import {
  IntakeCancelledError,
  isIntakeCancellation,
  throwIfIntakeCancelled,
} from "../src/lib/intake-cancellation.ts";

const active = new AbortController();
assert.doesNotThrow(() => throwIfIntakeCancelled(active.signal));

const cancelled = new AbortController();
cancelled.abort();
assert.throws(
  () => throwIfIntakeCancelled(cancelled.signal),
  (error) => isIntakeCancellation(error, cancelled.signal),
);

let published = false;
const running = new AbortController();
const work = (async () => {
  await Promise.resolve();
  running.abort();
  throwIfIntakeCancelled(running.signal);
  published = true;
})();
await assert.rejects(work, (error) => isIntakeCancellation(error, running.signal));
assert.equal(published, false);
assert.equal(isIntakeCancellation(new IntakeCancelledError()), true);

console.log("Running intake cancellation prevents post-cancel publication.");
`,
);

await write(
  "scripts/verify-intake-cancellation-contract.mjs",
  `import { readFile } from "node:fs/promises";

const files = Object.fromEntries(
  await Promise.all(
    [
      "src/components/material-intake-queue.tsx",
      "src/lib/material-intake.ts",
      "src/lib/material-fingerprints.ts",
      "src/lib/document-ingestion.ts",
      "src/lib/ingestion/pdf.ts",
      "src/lib/ingestion/docx.ts",
      "src/lib/ingestion/xlsx.ts",
      "src/lib/intake-cancellation.ts",
    ].map(async (path) => [path, await readFile(path, "utf8")]),
  ),
);
const failures = [];
const requireMarker = (path, marker) => {
  if (!files[path].includes(marker)) failures.push(`${path} is missing ${marker}`);
};

for (const marker of [
  "abortControllersRef",
  "new AbortController()",
  "controller.abort()",
  "prepareFileIntake(item.file, { signal })",
  "fingerprintFile(item.file, signal)",
  'status: cancelled ? "cancelled" : "error"',
]) {
  requireMarker("src/components/material-intake-queue.tsx", marker);
}
requireMarker("src/lib/material-intake.ts", "options: { signal?: AbortSignal }");
requireMarker("src/lib/material-intake.ts", "ingestFile(file, options.signal)");
requireMarker("src/lib/material-fingerprints.ts", "signal?: AbortSignal");
requireMarker("src/lib/document-ingestion.ts", "reader.abort()");
for (const path of [
  "src/lib/ingestion/pdf.ts",
  "src/lib/ingestion/docx.ts",
  "src/lib/ingestion/xlsx.ts",
]) {
  requireMarker(path, "throwIfIntakeCancelled(signal)");
}
requireMarker("src/lib/intake-cancellation.ts", "isIntakeCancellation");

if (failures.length > 0) {
  console.error("Intake cancellation contract failed:\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log("AbortController-backed running intake cancellation contract passed.");
`,
);

const packagePath = "package.json";
const packageJson = JSON.parse(await read(packagePath));
packageJson.scripts["verify:intake-cancellation-contract"] =
  "node scripts/verify-intake-cancellation-contract.mjs";
packageJson.scripts["eval:intake-cancellation"] =
  "node --experimental-strip-types scripts/run-intake-cancellation-evals.mjs";
await write(packagePath, JSON.stringify(packageJson, null, 2));
