import { spawnSync } from "node:child_process";

const patchPath = "patches/s4-001-course-workspace-accessibility.patch";

function runGitApply(extraArgs) {
  return spawnSync("git", ["apply", "--check", ...extraArgs, patchPath], {
    cwd: process.cwd(),
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
