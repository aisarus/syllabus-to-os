import { spawnSync } from "node:child_process";

const patchPath = "patches/s4-001-course-workspace-accessibility.patch";
const result = spawnSync("git", ["apply", "--check", patchPath], {
  cwd: process.cwd(),
  env: process.env,
  encoding: "utf8",
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

if (result.status !== 0) {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exit(result.status ?? 1);
}

console.log("CourseWorkspace accessibility patch applies cleanly.");
