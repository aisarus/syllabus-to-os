import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const read = (path) => readFile(resolve(process.cwd(), path), "utf8");
const [engine, store, lifecycle, workspace, appRoute, courseRoute, evals, roadmap, tasks, status] =
  await Promise.all([
    read("src/lib/concept-evidence.ts"),
    read("src/lib/concept-store.ts"),
    read("src/components/concept-evidence-lifecycle.tsx"),
    read("src/components/concept-evidence-workspace.tsx"),
    read("src/routes/app.tsx"),
    read("src/routes/app.courses_.$courseId.tsx"),
    read("scripts/run-concept-evidence-evals.mjs"),
    read("ROADMAP.md"),
    read("TASKS.md"),
    read("STATUS.md"),
  ]);

const failures = [];
const requireMarker = (content, marker, message) => {
  if (!content.includes(marker)) failures.push(message);
};

for (const marker of [
  "ConceptEvidenceKind",
  "ConceptKnowledgeState",
  "successes.length >= 4",
  "objectiveSuccesses.length >= 2",
  "distinctSuccessDays >= 2",
  "distinctSuccessKinds.length >= 2",
  "event.kind !== \"assessment\"",
  "event.outcome !== \"mixed\"",
  "reconcileConceptEvidenceData",
  "attemptsById",
]) {
  requireMarker(engine, marker, `Concept evidence engine is missing: ${marker}`);
}

for (const marker of [
  "one lucky answer must not create strong knowledge",
  "aggregate quiz context must not increase concept state",
  "manual self-evidence must remain secondary",
  "deleted practice must not leave dangling evidence",
  "unlinked quiz context must be removed",
]) {
  requireMarker(evals, marker, `Concept evidence evaluation is missing: ${marker}`);
}

for (const marker of [
  "lamdan.concept-evidence.v1",
  "recordFlashcardReviewEvidence",
  "syncQuizAttemptEvidence",
  "outcome: \"mixed\"",
  "never count as success or",
  "exportConceptEvidenceJSON",
  "importConceptEvidenceJSON",
]) {
  requireMarker(store, marker, `Concept store contract is missing: ${marker}`);
}

for (const marker of [
  "installConceptEvidenceBridge",
  "getDataSnapshot()",
  "reconcileConceptEvidence(hydratedCore)",
  "syncQuizAttemptEvidence(hydratedCore)",
]) {
  requireMarker(lifecycle, marker, `Concept lifecycle is missing: ${marker}`);
}

for (const marker of [
  "Карта знаний",
  "Файлы, конспекты и время не повышают состояние знания",
  "Context only",
  "Журнал доказательств",
  "conceptStore.deleteEvidence",
  "Причина не классифицирована",
]) {
  requireMarker(workspace, marker, `Knowledge map trust UI is missing: ${marker}`);
}

requireMarker(appRoute, "<ConceptEvidenceLifecycle />", "Concept evidence lifecycle is not mounted.");
requireMarker(
  courseRoute,
  "<ConceptEvidenceWorkspace courseId={courseId} />",
  "Course route does not expose the knowledge map.",
);

for (const [content, marker, file] of [
  [roadmap, "Phase 7 — Concepts and evidence-based mastery", "ROADMAP.md"],
  [tasks, "P1-013 — Concept graph and evidence model", "TASKS.md"],
  [status, "P1-013", "STATUS.md"],
]) {
  requireMarker(content, marker, `${file} is missing concept evidence status: ${marker}`);
}

if (failures.length > 0) {
  console.error("Concept evidence contract verification failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Concept evidence contract passed.");
