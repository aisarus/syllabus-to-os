import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDirectory, "..");
const verifierSource = readFileSync(
  resolve(repoRoot, "scripts/verify-course-workspace-accessibility-patch.mjs"),
  "utf8",
);
const patchSource = readFileSync(
  resolve(repoRoot, "patches/s4-001-course-workspace-accessibility.patch"),
  "utf8",
);

const expectedMarkers = [
  'aria-label={isRu ? "Название новой темы" : "New topic title"}',
  'aria-label={isRu ? "Тема для загружаемого материала" : "Topic for uploaded material"}',
  '<strong dir="auto" className="block truncate">',
  '<span dir="auto" className="mt-1 block line-clamp-2 text-muted-foreground">',
  '<strong dir="auto" className="block truncate text-sm hover:text-primary">',
];

function buildSource() {
  const lines = Array.from({ length: 253 }, () => "// fixture filler");
  lines.push(
    '            <div className="mt-4 flex flex-col gap-2 sm:flex-row">',
    "              <Input",
    "                value={newTopic}",
    "                onChange={(event) => setNewTopic(event.target.value)}",
    "                onKeyDown={(event) => {",
    '                  if (event.key === "Enter") addTopic();',
  );
  while (lines.length < 388) lines.push("// fixture filler");
  lines.push(
    "            </p>",
    '            <div className="mt-3 space-y-3">',
    "              <Select value={uploadTopicId} onValueChange={setUploadTopicId}>",
    "                <SelectTrigger>",
    "                  <SelectValue />",
    "                </SelectTrigger>",
    "                <SelectContent>",
  );
  while (lines.length < 524) lines.push("// fixture filler");
  lines.push(
    "                          }",
    "                        >",
    '                          <strong className="block truncate">',
    '                            {chunk.title || `${isRu ? "Фрагмент" : "Chunk"} ${chunk.order + 1}`}',
    "                          </strong>",
    '                          <span className="mt-1 block line-clamp-2 text-muted-foreground">',
    "                            {chunk.text}",
    "                          </span>",
    "                        </button>",
  );
  while (lines.length < 710) lines.push("// fixture filler");
  lines.push(
    "        params={{ materialId: material.id }}",
    '        className="min-w-0 flex-1"',
    "      >",
    '        <strong className="block truncate text-sm hover:text-primary">{material.title}</strong>',
    '        <span className="text-[10px] uppercase text-muted-foreground">',
    "          {material.type} · {material.processingStatus}",
    "        </span>",
  );
  return `${lines.join("\n")}\n`;
}

function run(command, args, cwd) {
  return spawnSync(command, args, { cwd, encoding: "utf8" });
}

function formatFailure(result) {
  const parts = [];
  if (result.error) parts.push(String(result.error));
  if (result.stdout) parts.push(result.stdout);
  if (result.stderr) parts.push(result.stderr);
  return parts.join("\n").trim();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function countOccurrences(source, marker) {
  return source.split(marker).length - 1;
}

function assertState(name, result, expectedStatus, expectedText) {
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (result.error || result.status !== expectedStatus || !output.includes(expectedText)) {
    throw new Error(
      `[${name}] expected status ${expectedStatus} and text: ${expectedText}\n${formatFailure(result)}`,
    );
  }
}

const fixtureRoot = mkdtempSync(join(tmpdir(), "lamdan-a11y-patch-"));
const invocationRoot = mkdtempSync(join(tmpdir(), "lamdan-a11y-patch-invocation-"));
try {
  mkdirSync(join(fixtureRoot, "src/components"), { recursive: true });
  mkdirSync(join(fixtureRoot, "patches"), { recursive: true });
  mkdirSync(join(fixtureRoot, "scripts"), { recursive: true });
  const verifierPath = join(
    fixtureRoot,
    "scripts/verify-course-workspace-accessibility-patch.mjs",
  );
  writeFileSync(verifierPath, verifierSource);
  writeFileSync(
    join(fixtureRoot, "patches/s4-001-course-workspace-accessibility.patch"),
    patchSource,
  );
  const componentPath = join(fixtureRoot, "src/components/course-workspace.tsx");
  const originalSource = buildSource();
  writeFileSync(componentPath, originalSource);
  const init = run("git", ["init", "-q"], fixtureRoot);
  if (init.error || init.status !== 0) {
    throw new Error(`git init failed:\n${formatFailure(init)}`);
  }

  assertState(
    "ready",
    run(process.execPath, [verifierPath], fixtureRoot),
    0,
    "CourseWorkspace accessibility patch is ready to apply.",
  );
  assertState(
    "ready-external-cwd",
    run(process.execPath, [verifierPath], invocationRoot),
    0,
    "CourseWorkspace accessibility patch is ready to apply.",
  );

  const apply = run(
    "git",
    ["apply", "patches/s4-001-course-workspace-accessibility.patch"],
    fixtureRoot,
  );
  if (apply.error || apply.status !== 0) {
    throw new Error(`git apply failed:\n${formatFailure(apply)}`);
  }
  const patchedSource = readFileSync(componentPath, "utf8");
  for (const marker of expectedMarkers) {
    const count = countOccurrences(patchedSource, marker);
    assert(count === 1, `applied patch expected marker exactly once, found ${count}: ${marker}`);
  }
  assertState(
    "already-applied",
    run(process.execPath, [verifierPath], fixtureRoot),
    0,
    "CourseWorkspace accessibility patch is already applied.",
  );

  const conflictSource = originalSource.replace("value={newTopic}", "value={newTopic.trim()}");
  writeFileSync(componentPath, conflictSource);
  assertState(
    "conflict",
    run(process.execPath, [verifierPath], fixtureRoot),
    1,
    "CourseWorkspace accessibility patch is neither cleanly applicable nor already applied.",
  );
  assert(readFileSync(componentPath, "utf8") === conflictSource, "conflict verification changed source");
} finally {
  rmSync(invocationRoot, { recursive: true, force: true });
  rmSync(fixtureRoot, { recursive: true, force: true });
}

console.log("CourseWorkspace accessibility patch verifier fixtures passed: 4/4 with 5/5 unique markers.");
