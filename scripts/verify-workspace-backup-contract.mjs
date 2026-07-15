import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const read = (path) => readFile(resolve(process.cwd(), path), "utf8");
const [
  workspace,
  route,
  details,
  evals,
  browserE2E,
  visualContract,
  packageJson,
  checkScript,
  workflow,
  status,
  plans,
] = await Promise.all([
  read("src/lib/workspace-backup.ts"),
  read("src/routes/app.data.tsx"),
  read("src/lib/quiz-attempt-details.ts"),
  read("scripts/run-workspace-backup-evals.mjs"),
  read("scripts/run-workspace-backup-browser-e2e.mjs"),
  read("scripts/verify-visual-backup-contract.mjs"),
  read("package.json"),
  read("scripts/check.mjs"),
  read(".github/workflows/ci.yml"),
  read("STATUS.md"),
  read("PLANS.md"),
]);

const failures = [];
const requireMarker = (content, marker, message) => {
  if (!content.includes(marker)) failures.push(message);
};

for (const marker of [
  'FULL_WORKSPACE_BACKUP_FORMAT = "lamdan-workspace-backup"',
  "FULL_WORKSPACE_BACKUP_VERSION = 2",
  "workspace/visual-backup-v1.zip",
  "workspace/concept-evidence.json",
  "workspace/quiz-attempt-details.json",
  "addPayload",
  "sha256",
  "validateArchiveEntries",
  "Legacy v1 archive has no concept graph",
  "Merge keeps current evidence; replace clears it",
  "previewWorkspaceEvidenceMerge",
  "mergeWorkspaceEvidenceSafely",
  "blockedConceptIds",
  "replaceQuizAttemptDetailData",
  "replaceConceptEvidenceVerified",
  "Workspace backup import was rolled back",
  "replaceVisualSourceBackupSnapshot(previousVisual)",
  "replaceAllAtomically(previousCore)",
  "replaceQuizAttemptDetailData(previousDetails)",
  "replaceConceptEvidenceVerified(previousConcepts)",
]) {
  requireMarker(workspace, marker, `Workspace backup engine is missing: ${marker}`);
}

for (const marker of [
  "replaceQuizAttemptDetailData",
  "reconcileQuizAttemptDetailData",
  "Per-question quiz evidence could not be verified after saving",
]) {
  requireMarker(details, marker, `Attempt-detail replacement contract is missing: ${marker}`);
}

for (const marker of [
  'from "@/lib/workspace-backup"',
  "Workspace ZIP v2",
  "concept graph",
  "immutable question answers",
  "MAX_FULL_WORKSPACE_BACKUP_BYTES",
  "fullBackupPreview.summary.concepts",
  "fullBackupPreview.summary.evidenceEvents",
  "fullBackupPreview.summary.detailedAttempts",
  "fullBackupPreview.summary.answerSnapshots",
  "all four layers",
]) {
  requireMarker(route, marker, `Data management workspace backup UI is missing: ${marker}`);
}

for (const marker of [
  "tampered evidence payload must be rejected before import",
  "Merge keeps current evidence",
  "evidence for a conflicting concept must not be mixed in",
  "Workspace backup v2 evaluations passed",
]) {
  requireMarker(evals, marker, `Workspace backup evaluation is missing: ${marker}`);
}

for (const marker of [
  "Workspace backup v2 browser restore, tamper and rollback E2E passed",
  "checksum mismatch",
  "Storage.prototype.setItem",
  "Workspace backup import was rolled back",
  "await page.reload()",
]) {
  requireMarker(browserE2E, marker, `Workspace backup browser proof is missing: ${marker}`);
}

requireMarker(
  visualContract,
  "workspace-backup.ts",
  "Legacy visual backup contract does not acknowledge the workspace v2 wrapper.",
);
for (const marker of [
  '"eval:workspace-backup"',
  '"e2e:workspace-backup"',
  '"verify:workspace-backup-contract"',
]) {
  requireMarker(packageJson, marker, `package.json is missing: ${marker}`);
}
for (const marker of ['"verify:workspace-backup-contract"', '"eval:workspace-backup"']) {
  requireMarker(checkScript, marker, `Canonical checks are missing: ${marker}`);
}
for (const marker of [
  "Verify workspace backup v2 contract",
  "Run workspace backup v2 evaluations",
  "Run workspace backup browser E2E",
  "workspace_backup_e2e",
  "workspace-backup-e2e-output.txt",
]) {
  requireMarker(workflow, marker, `CI workspace backup gate is missing: ${marker}`);
}
for (const [content, marker, file] of [
  [status, "Workspace backup v2", "STATUS.md"],
  [plans, "Workspace backup v2", "PLANS.md"],
]) {
  requireMarker(content, marker, `${file} is missing workspace backup status: ${marker}`);
}

if (failures.length > 0) {
  console.error("Workspace backup v2 contract verification failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Workspace backup v2 trust, compatibility, preview and rollback contract passed.");
