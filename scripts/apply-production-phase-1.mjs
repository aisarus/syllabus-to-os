import { readFile, writeFile } from "node:fs/promises";

const mode = process.argv[2];
if (!new Set(["docs", "store"]).has(mode)) {
  throw new Error("Usage: node scripts/apply-production-phase-1.mjs <docs|store>");
}

async function read(path) {
  return readFile(path, "utf8");
}

async function write(path, content) {
  await writeFile(path, content.endsWith("\n") ? content : `${content}\n`, "utf8");
}

function replaceExact(content, before, after, label) {
  if (!content.includes(before)) {
    throw new Error(`Patch anchor not found: ${label}`);
  }
  return content.replace(before, after);
}

async function patchDocs() {
  const statusPath = "STATUS.md";
  let status = await read(statusPath);
  status = replaceExact(
    status,
    "Last updated: 2026-07-16",
    "Last updated: 2026-07-19",
    "STATUS date",
  );
  status = replaceExact(
    status,
    "Lamdan remains a late MVP / early closed alpha. The trusted local-first source → review → output loop is implemented. M1 is still blocked on private live OCR and quiz validation. Concept evidence, reviewed extraction, open-answer repair, collision hardening, Exam Engine v1, durable whole-lecture media intake and reviewed automatic transcription v1 are implemented and verified. Resumable long-file transcription C1 is the active delivery pass.",
    "Lamdan remains a late MVP / early closed alpha. The trusted local-first source → review → output → practice loop is implemented. M1 is still blocked on licensed live OCR, Hebrew golden-quiz validation and the complete one-course pilot. Main now includes long-lecture extraction/backup/restore, focused dashboard and navigation, source-safe page replacement, a connected Understand → Recall → Test loop, Study Pack continuation, quiz mistake repair and canonical frozen-exam result/repair flows through PR #72. Production Phase 1 is active: persistence honesty, explicit repository boundaries, API resource controls, cancellation and accessibility hardening.",
    "STATUS milestone summary",
  );
  status = status.replace(
    "## Completed task state\n",
    "## Main reconciliation — 2026-07-19\n\n- PRs #52–#58 completed local lecture extraction, streaming backup/restore, licensed-quality evaluation infrastructure and bounded exam planning.\n- PRs #61–#64 reorganized navigation, dashboard, material/course hierarchy and the Understand → Recall → Test loop.\n- PRs #65–#66 hardened source-reference deletion and multi-page replacement browser proof.\n- PRs #67–#72 completed Study Pack continuation, quiz mistake repair, diagnostic exam deep links, canonical result review and focused frozen-question repair.\n- Open PR #59 is superseded by this reconciliation because it predates PRs #61–#72.\n\n## Completed task state\n",
  );
  await write(statusPath, status);

  const tasksPath = "TASKS.md";
  let tasks = await read(tasksPath);
  tasks = tasks.replace(
    "## Status legend\n",
    "## Active production-readiness pass — 2026-07-19\n\nThe canonical product backlog below remains intact. The current cross-cutting execution order is:\n\n1. `[~] PROD-001` — durable persistence boundary: publish state only after verified storage.\n2. `[~] PROD-002` — explicit `WorkspaceRepository`; remove import-order store monkey-patching.\n3. `[ ] PROD-003` — shared runtime API schemas, error envelope and bounded AI resource policy.\n4. `[ ] PROD-004` — real cancellation for running intake/provider work.\n5. `[ ] PROD-005` — keyboard, focus, contrast and mixed-direction accessibility baseline.\n6. `[!] PROD-006` — licensed OCR/quiz/transcription evidence and one-course pilot.\n\nMerged main already includes the UX/exam sequence through PR #72; historical entries that mention older active PRs are evidence records, not the current execution state.\n\n## Status legend\n",
  );
  await write(tasksPath, tasks);

  const plansPath = "PLANS.md";
  let plans = await read(plansPath);
  plans = plans.replace(
    "## M1 validation plan — P1-006 to P1-008\n",
    "## Active production Phase 1 — stabilization\n\n**Branch:** `agent/production-phase-1-stabilization`\n\n1. Reconcile execution documents with merged main through PR #72.\n2. Make local workspace writes durable-before-publish and regression-test quota failure.\n3. Replace import-order method mutation with an explicit repository boundary and base-store source integrity.\n4. Add shared runtime validation and bounded AI/OCR/transcription execution.\n5. Add real running-job cancellation and accessibility baseline.\n6. Execute the one-course pilot when licensed external fixtures are supplied.\n\nNo cloud backend, broad redesign or new product surface enters this phase.\n\n## M1 validation plan — P1-006 to P1-008\n",
  );
  await write(plansPath, plans);
}

async function patchStore() {
  const storePath = "src/lib/store.ts";
  let store = await read(storePath);
  store = replaceExact(
    store,
    'import { useSyncExternalStore } from "react";\n',
    'import { useSyncExternalStore } from "react";\nimport { persistWorkspaceSnapshot, type StorageLike, type WorkspacePersistenceHealth } from "./persistence-health";\nimport { scrubSourceChunkReferences } from "./source-reference-safety";\nimport { replaceMaterialChunksWithStableIds } from "./source-integrity";\n',
    "store imports",
  );
  store = replaceExact(
    store,
    `function persist() {\n  try {\n    localStorage.setItem(KEY, JSON.stringify(state));\n  } catch {\n    // A full localStorage quota must not prevent in-memory UI updates.\n  }\n  listeners.forEach((l) => l());\n}\n`,
    `export class WorkspacePersistenceError extends Error {\n  readonly health: WorkspacePersistenceHealth;\n\n  constructor(health: WorkspacePersistenceHealth) {\n    super(health.error ?? "Browser-local workspace save failed.");\n    this.name = "WorkspacePersistenceError";\n    this.health = health;\n  }\n}\n\nexport function commitWorkspaceData(next: AppData, storage?: StorageLike): void {\n  const health = persistWorkspaceSnapshot(next, storage);\n  if (!health.ok) throw new WorkspacePersistenceError(health);\n  state = next;\n  listeners.forEach((listener) => listener());\n}\n`,
    "durable persistence",
  );
  store = replaceExact(
    store,
    `export function setData(next: AppData) {\n  state = next;\n  persist();\n}\n\nexport function updateData(fn: (d: AppData) => AppData) {\n  state = fn(state);\n  persist();\n}\n`,
    `export function setData(next: AppData) {\n  ensureHydrated();\n  commitWorkspaceData(next);\n}\n\nexport function updateData(fn: (d: AppData) => AppData) {\n  ensureHydrated();\n  const next = fn(state);\n  commitWorkspaceData(next);\n}\n`,
    "set/update data",
  );
  store = replaceExact(
    store,
    `  deleteMaterial(id: string) {\n    updateData((d) => ({\n      ...d,\n      materials: d.materials.filter((m) => m.id !== id),\n      materialChunks: d.materialChunks.filter((ch) => ch.materialId !== id),\n      materialOutputs: d.materialOutputs.filter((o) => o.materialId !== id),\n      notes: d.notes.map((n) => (n.materialId === id ? { ...n, materialId: undefined } : n)),\n      flashcards: d.flashcards.map((c) =>\n        c.materialId === id ? { ...c, materialId: undefined } : c,\n      ),\n      quizzes: d.quizzes.map((q) => (q.materialId === id ? { ...q, materialId: undefined } : q)),\n      presentationOutlines: d.presentationOutlines.map((p) =>\n        p.materialId === id ? { ...p, materialId: undefined } : p,\n      ),\n    }));\n  },`,
    `  deleteMaterial(id: string) {\n    updateData((data) => {\n      const removedChunkIds = data.materialChunks\n        .filter((chunk) => chunk.materialId === id)\n        .map((chunk) => chunk.id);\n      const withoutMaterial: AppData = {\n        ...data,\n        materials: data.materials.filter((material) => material.id !== id),\n        materialChunks: data.materialChunks.filter((chunk) => chunk.materialId !== id),\n        materialOutputs: data.materialOutputs.filter((output) => output.materialId !== id),\n        notes: data.notes.map((note) =>\n          note.materialId === id ? { ...note, materialId: undefined } : note,\n        ),\n        flashcards: data.flashcards.map((card) =>\n          card.materialId === id ? { ...card, materialId: undefined } : card,\n        ),\n        quizzes: data.quizzes.map((quiz) =>\n          quiz.materialId === id ? { ...quiz, materialId: undefined } : quiz,\n        ),\n        presentationOutlines: data.presentationOutlines.map((outline) =>\n          outline.materialId === id ? { ...outline, materialId: undefined } : outline,\n        ),\n      };\n      return scrubSourceChunkReferences(withoutMaterial, removedChunkIds);\n    });\n  },`,
    "safe material delete",
  );
  store = replaceExact(
    store,
    `  deleteMaterialChunk(id: string) {\n    updateData((d) => ({\n      ...d,\n      materialChunks: d.materialChunks.filter((ch) => ch.id !== id),\n      notes: d.notes.map((n) =>\n        n.sourceChunkIds?.includes(id)\n          ? { ...n, sourceChunkIds: n.sourceChunkIds.filter((x) => x !== id) }\n          : n,\n      ),\n      flashcards: d.flashcards.map((c) =>\n        c.sourceChunkIds?.includes(id)\n          ? { ...c, sourceChunkIds: c.sourceChunkIds.filter((x) => x !== id) }\n          : c,\n      ),\n      quizQuestions: d.quizQuestions.map((q) =>\n        q.sourceChunkIds?.includes(id)\n          ? { ...q, sourceChunkIds: q.sourceChunkIds.filter((x) => x !== id) }\n          : q,\n      ),\n    }));\n  },`,
    `  deleteMaterialChunk(id: string) {\n    updateData((data) =>\n      scrubSourceChunkReferences(\n        {\n          ...data,\n          materialChunks: data.materialChunks.filter((chunk) => chunk.id !== id),\n        },\n        [id],\n      ),\n    );\n  },`,
    "safe chunk delete",
  );
  store = replaceExact(
    store,
    `  replaceMaterialChunksForMaterial(\n    materialId: string,\n    chunks: Array<Omit<MaterialChunk, "id" | "createdAt" | "materialId">>,\n  ) {\n    const now = Date.now();\n    const created: MaterialChunk[] = chunks.map((c, i) => ({\n      ...c,\n      order: c.order ?? i,\n      materialId,\n      id: uid("chk"),\n      createdAt: now,\n    }));\n    updateData((d) => ({\n      ...d,\n      materialChunks: [\n        ...d.materialChunks.filter((ch) => ch.materialId !== materialId),\n        ...created,\n      ],\n    }));\n    return created;\n  },`,
    `  replaceMaterialChunksForMaterial(\n    materialId: string,\n    chunks: Array<Omit<MaterialChunk, "id" | "createdAt" | "materialId">>,\n  ) {\n    let created: MaterialChunk[] = [];\n    updateData((data) => {\n      const replacement = replaceMaterialChunksWithStableIds(data, materialId, chunks, () =>\n        uid("chk"),\n      );\n      created = replacement.chunks;\n      return replacement.data;\n    });\n    return created;\n  },`,
    "stable chunk replacement",
  );
  store = replaceExact(
    store,
    `export function replaceAllAtomically(next: AppData): void {\n  const normalized = normalizeAppData(next as unknown as Record<string, unknown>);\n  const serialized = JSON.stringify(normalized);\n  if (typeof window !== "undefined") {\n    localStorage.setItem(KEY, serialized);\n  }\n  state = normalized;\n  listeners.forEach((listener) => listener());\n}\n`,
    `export function replaceAllAtomically(next: AppData): void {\n  const normalized = normalizeAppData(next as unknown as Record<string, unknown>);\n  commitWorkspaceData(normalized);\n}\n`,
    "atomic replace",
  );
  await write(storePath, store);

  await write(
    "src/lib/source-reference-safety.ts",
    `import type { AppData } from "./store";\n\nexport function scrubSourceChunkReferences(\n  data: AppData,\n  chunkIds: Iterable<string>,\n): AppData {\n  const removedIds = new Set(chunkIds);\n  if (removedIds.size === 0) return data;\n\n  const rewrite = (ids: string[] | undefined): string[] | undefined => {\n    if (!ids) return ids;\n    const next = Array.from(new Set(ids.filter((id) => !removedIds.has(id))));\n    if (next.length === ids.length && next.every((id, index) => id === ids[index])) return ids;\n    return next;\n  };\n\n  const notes = data.notes.map((note) => {\n    const sourceChunkIds = rewrite(note.sourceChunkIds);\n    return sourceChunkIds === note.sourceChunkIds ? note : { ...note, sourceChunkIds };\n  });\n  const flashcards = data.flashcards.map((card) => {\n    const sourceChunkIds = rewrite(card.sourceChunkIds);\n    return sourceChunkIds === card.sourceChunkIds ? card : { ...card, sourceChunkIds };\n  });\n  const quizQuestions = data.quizQuestions.map((question) => {\n    const sourceChunkIds = rewrite(question.sourceChunkIds);\n    return sourceChunkIds === question.sourceChunkIds ? question : { ...question, sourceChunkIds };\n  });\n  const presentationOutlines = data.presentationOutlines.map((outline) => {\n    let changed = false;\n    const slides = outline.slides.map((slide) => {\n      const sourceChunkIds = rewrite(slide.sourceChunkIds);\n      if (sourceChunkIds === slide.sourceChunkIds) return slide;\n      changed = true;\n      return { ...slide, sourceChunkIds };\n    });\n    return changed ? { ...outline, slides, updatedAt: Date.now() } : outline;\n  });\n\n  return { ...data, notes, flashcards, quizQuestions, presentationOutlines };\n}\n`,
  );

  await write(
    "src/lib/workspace-repository.ts",
    `import { getDataSnapshot, setData, updateData, type AppData } from "./store";\n\nexport interface WorkspaceRepository {\n  snapshot(): AppData;\n  replace(next: AppData): void;\n  transact(mutator: (current: AppData) => AppData): void;\n}\n\nexport class LocalWorkspaceRepository implements WorkspaceRepository {\n  snapshot(): AppData {\n    return getDataSnapshot();\n  }\n\n  replace(next: AppData): void {\n    setData(next);\n  }\n\n  transact(mutator: (current: AppData) => AppData): void {\n    updateData(mutator);\n  }\n}\n\nexport const workspaceRepository: WorkspaceRepository = new LocalWorkspaceRepository();\n`,
  );

  await write(
    "src/lib/source-safe-store.ts",
    `export { scrubSourceChunkReferences } from "./source-reference-safety";\nexport { commitWorkspaceData, getDataSnapshot, setData, store } from "./store";\nexport { workspaceRepository } from "./workspace-repository";\n`,
  );

  await write(
    "src/lib/install-store-safety.ts",
    `/**\n * Kept temporarily for compatibility with old imports. Safety now lives in the\n * base store and the explicit WorkspaceRepository; no methods are mutated at\n * module-evaluation time.\n */\nexport function installStoreSafetyGuards(): void {\n  // Intentionally empty. Remove callers during the repository migration.\n}\n`,
  );

  const rootPath = "src/routes/__root.tsx";
  let root = await read(rootPath);
  root = replaceExact(root, 'import "@/lib/source-safe-store";\n', "", "root side-effect import");
  await write(rootPath, root);

  const lifecyclePath = "src/components/store-safety-lifecycle.tsx";
  let lifecycle = await read(lifecyclePath);
  lifecycle = lifecycle.replace('import "@/lib/install-store-safety";\n', "");
  lifecycle = lifecycle.replace(
    "Keeps the legacy local-first store honest without changing its persisted v1\n * schema.",
    "Keeps the local-first store observable while the explicit repository boundary\n * preserves the persisted v1 schema.",
  );
  await write(lifecyclePath, lifecycle);

  const evalPath = "scripts/run-store-safety-evals.mjs";
  let evaluation = await read(evalPath);
  evaluation = evaluation.replace(
    'import { getDataSnapshot, setData, store } from "../src/lib/source-safe-store.ts";',
    'import { commitWorkspaceData, getDataSnapshot, setData, store } from "../src/lib/source-safe-store.ts";',
  );
  evaluation = evaluation.replace(
    'assert.match(failed.error, /storage is full/i);\n\nconsole.log("Store persistence honesty and source-reference integrity evaluations passed.");',
    `assert.match(failed.error, /storage is full/i);\n\nsetData(linked);\nconst beforeFailedCommit = getDataSnapshot();\nassert.throws(\n  () => commitWorkspaceData(base({ notes: [] }), fullStorage),\n  /storage is full/i,\n);\nassert.deepEqual(getDataSnapshot(), beforeFailedCommit);\n\nconsole.log("Store durable-before-publish and source-reference integrity evaluations passed.");`,
  );
  await write(evalPath, evaluation);

  await write(
    "scripts/verify-store-safety-contract.mjs",
    `import { readFile } from "node:fs/promises";\nimport { resolve } from "node:path";\n\nconst read = (path) => readFile(resolve(process.cwd(), path), "utf8");\nconst [appRoute, lifecycle, store, repository, compatibility, persistence, integrity, privateRunner, tasks, status] =\n  await Promise.all([\n    read("src/routes/app.tsx"),\n    read("src/components/store-safety-lifecycle.tsx"),\n    read("src/lib/store.ts"),\n    read("src/lib/workspace-repository.ts"),\n    read("src/lib/install-store-safety.ts"),\n    read("src/lib/persistence-health.ts"),\n    read("src/lib/source-integrity.ts"),\n    read("scripts/run-private-ocr-provider.mjs"),\n    read("TASKS.md"),\n    read("STATUS.md"),\n  ]);\n\nconst failures = [];\nconst requireMarker = (content, marker, message) => {\n  if (!content.includes(marker)) failures.push(message);\n};\nconst forbidMarker = (content, marker, message) => {\n  if (content.includes(marker)) failures.push(message);\n};\n\nrequireMarker(appRoute, "<StoreSafetyLifecycle />", "The app shell does not mount persistence health UI.");\nfor (const marker of ["inspectWorkspacePersistence", "persistWorkspaceSnapshot", "repairDanglingSourceReferences", "Аварийная JSON-копия"]) {\n  requireMarker(lifecycle, marker, \`Store safety lifecycle is missing: \${marker}\`);\n}\nfor (const marker of ["commitWorkspaceData", "WorkspacePersistenceError", "persistWorkspaceSnapshot", "scrubSourceChunkReferences", "replaceMaterialChunksWithStableIds"]) {\n  requireMarker(store, marker, \`Base store durable/source-safe contract is missing: \${marker}\`);\n}\nfor (const marker of ["WorkspaceRepository", "LocalWorkspaceRepository", "transact", "snapshot"]) {\n  requireMarker(repository, marker, \`Workspace repository contract is missing: \${marker}\`);\n}\nforbidMarker(compatibility, "store.updateNote =", "Compatibility module still monkey-patches updateNote.");\nforbidMarker(compatibility, "store.replaceMaterialChunksForMaterial =", "Compatibility module still monkey-patches chunk replacement.");\nfor (const marker of ["LAMDAN_DATA_STORAGE_KEY", "QuotaExceededError", "inspectWorkspacePersistence"]) {\n  requireMarker(persistence, marker, \`Persistence honesty contract is missing: \${marker}\`);\n}\nfor (const marker of ["replaceMaterialChunksWithStableIds", "repairDanglingSourceReferences", "presentationOutlines", "sourceChunkIds"]) {\n  requireMarker(integrity, marker, \`Source-integrity contract is missing: \${marker}\`);\n}\nfor (const marker of ["/api/ai/ocr-image", "--require-external-candidates", "private-eval-candidates", "promptVersion"]) {\n  requireMarker(privateRunner, marker, \`Private OCR runner is missing: \${marker}\`);\n}\nrequireMarker(tasks, "PROD-001", "TASKS.md does not contain the production persistence pass.");\nrequireMarker(status, "Production Phase 1", "STATUS.md does not record the production stabilization pass.");\n\nif (failures.length > 0) {\n  console.error("Store safety contract verification failed:\\n");\n  for (const failure of failures) console.error(\`- \${failure}\`);\n  process.exit(1);\n}\n\nconsole.log("Durable workspace repository and source-integrity contract passed.");\n`,
  );
}

if (mode === "docs") await patchDocs();
if (mode === "store") await patchStore();
