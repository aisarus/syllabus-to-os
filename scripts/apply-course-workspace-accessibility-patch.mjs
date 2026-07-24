import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDirectory, "..");
const patchPath = join(repoRoot, "patches/s4-001-course-workspace-accessibility.patch");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function runGitApply(args) {
  return spawnSync("git", ["apply", ...args, patchPath], {
    cwd: repoRoot,
    env: process.env,
    encoding: "utf8",
  });
}

function runContract() {
  return spawnSync(npmCommand, ["run", "verify:course-workspace-contract"], {
    cwd: repoRoot,
    env: process.env,
    encoding: "utf8",
  });
}

function printResult(result) {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
}

function verifyContract({ rollbackOnFailure }) {
  const contract = runContract();
  if (!contract.error && contract.status === 0) return;

  printResult(contract);
  if (contract.error) console.error(contract.error);

  if (rollbackOnFailure) {
    const rollback = runGitApply(["--reverse"]);
    if (rollback.error || rollback.status !== 0) {
      console.error("CourseWorkspace contract failed and automatic patch rollback also failed.");
      if (rollback.error) console.error(rollback.error);
      printResult(rollback);
      process.exit(1);
    }
    console.error("CourseWorkspace contract failed; the accessibility patch was rolled back.");
  } else {
    console.error("CourseWorkspace accessibility patch is present, but its contract verification failed.");
  }

  process.exit(contract.status ?? 1);
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
  verifyContract({ rollbackOnFailure: true });
  console.log("CourseWorkspace accessibility patch applied and contract verified.");
  process.exit(0);
}

const reverse = runGitApply(["--check", "--reverse"]);
if (reverse.error) {
  console.error(reverse.error);
  process.exit(1);
}

if (reverse.status === 0) {
  verifyContract({ rollbackOnFailure: false });
  console.log("CourseWorkspace accessibility patch is already applied and contract verified; no changes made.");
  process.exit(0);
}

console.error("CourseWorkspace accessibility patch cannot be applied cleanly.");
printResult(forward);
printResult(reverse);
process.exit(1);
