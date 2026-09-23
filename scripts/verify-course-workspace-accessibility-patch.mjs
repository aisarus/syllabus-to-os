import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDirectory, "..");
const patchPath = join(repoRoot, "patches/s4-001-course-workspace-accessibility.patch");

function runGitApply(extraArgs) {
  return spawnSync("git", ["apply", "--check", ...extraArgs, patchPath], {
    cwd: repoRoot,
    env: process.env,
    encoding: "utf8",
  });
}

function fail(result) {
  if (result.error) console.error(result.error);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exit(result.status ?? 1);
}

const forward = runGitApply([]);
if (forward.error) fail(forward);
if (forward.status === 0) {
  console.log("CourseWorkspace accessibility patch is ready to apply.");
  process.exit(0);
}

const reverse = runGitApply(["--reverse"]);
if (reverse.error) fail(reverse);
if (reverse.status === 0) {
  console.log("CourseWorkspace accessibility patch is already applied.");
  process.exit(0);
}

console.error("CourseWorkspace accessibility patch is neither cleanly applicable nor already applied.");
if (forward.stderr) process.stderr.write(forward.stderr);
if (reverse.stderr) process.stderr.write(reverse.stderr);
process.exit(1);
