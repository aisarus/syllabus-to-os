import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const verifierPath = resolve(repoRoot, "scripts/verify-course-workspace-accessibility-patch.mjs");
const patchSource = readFileSync(
  resolve(repoRoot, "patches/s4-001-course-workspace-accessibility.patch"),
  "utf8",
);

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

function assertState(name, result, expectedStatus, expectedText) {
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (result.status !== expectedStatus || !output.includes(expectedText)) {
    console.error(`[${name}] expected status ${expectedStatus} and text: ${expectedText}`);
    if (output) process.stderr.write(output);
    process.exit(1);
  }
}

const fixtureRoot = mkdtempSync(join(tmpdir(), "lamdan-a11y-patch-"));
try {
  mkdirSync(join(fixtureRoot, "src/components"), { recursive: true });
  mkdirSync(join(fixtureRoot, "patches"), { recursive: true });
  writeFileSync(
    join(fixtureRoot, "patches/s4-001-course-workspace-accessibility.patch"),
    patchSource,
  );
  const componentPath = join(fixtureRoot, "src/components/course-workspace.tsx");
  const originalSource = buildSource();
  writeFileSync(componentPath, originalSource);
  const init = run("git", ["init", "-q"], fixtureRoot);
  if (init.error || init.status !== 0) {
    console.error(init.error ?? init.stderr);
    process.exit(1);
  }

  assertState(
    "ready",
    run(process.execPath, [verifierPath], fixtureRoot),
    0,
    "CourseWorkspace accessibility patch is ready to apply.",
  );

  const apply = run(
    "git",
    ["apply", "patches/s4-001-course-workspace-accessibility.patch"],
    fixtureRoot,
  );
  if (apply.error || apply.status !== 0) {
    console.error(apply.error ?? apply.stderr);
    process.exit(1);
  }
  assertState(
    "already-applied",
    run(process.execPath, [verifierPath], fixtureRoot),
    0,
    "CourseWorkspace accessibility patch is already applied.",
  );

  writeFileSync(componentPath, originalSource.replace("value={newTopic}", "value={newTopic.trim()}"));
  assertState(
    "conflict",
    run(process.execPath, [verifierPath], fixtureRoot),
    1,
    "CourseWorkspace accessibility patch is neither cleanly applicable nor already applied.",
  );
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}

console.log("CourseWorkspace accessibility patch verifier fixtures passed: 3/3.");
