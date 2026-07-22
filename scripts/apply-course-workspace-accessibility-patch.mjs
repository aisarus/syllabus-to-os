import { spawnSync } from "node:child_process";

const patchPath = "patches/s4-001-course-workspace-accessibility.patch";

function runGitApply(args) {
  return spawnSync("git", ["apply", ...args, patchPath], {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
  });
}

function printResult(result) {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
}

const forward = runGitApply(["--check"]);
if (forward.error) {
  console.error(forward.error);
  process.exit(1);
}

if (forward.status === 0) {
  const apply = runGitApply([]);
  if (apply.error) {
    console.error(apply.error);
    process.exit(1);
  }
  if (apply.status !== 0) {
    printResult(apply);
    process.exit(apply.status ?? 1);
  }
  console.log("CourseWorkspace accessibility patch applied.");
  process.exit(0);
}

const reverse = runGitApply(["--check", "--reverse"]);
if (reverse.error) {
  console.error(reverse.error);
  process.exit(1);
}

if (reverse.status === 0) {
  console.log("CourseWorkspace accessibility patch is already applied; no changes made.");
  process.exit(0);
}

console.error("CourseWorkspace accessibility patch cannot be applied cleanly.");
printResult(forward);
printResult(reverse);
process.exit(1);
