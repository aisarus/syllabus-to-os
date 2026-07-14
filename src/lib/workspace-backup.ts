import JSZip from "jszip";
import {
  emptyConceptEvidenceData,
  normalizeConceptEvidenceData,
  reconcileConceptEvidenceData,
  type ConceptEvidenceData,
} from "./concept-evidence";
import { conceptStore, getConceptEvidenceSnapshot } from "./concept-store";
import {
  emptyQuizAttemptDetailData,
  getQuizAttemptDetailSnapshot,
  normalizeQuizAttemptDetailData,
  reconcileQuizAttemptDetailData,
  replaceQuizAttemptDetailData,
  type QuizAttemptDetailData,
} from "./quiz-attempt-details";
import { getDataSnapshot, replaceAllAtomically, type AppData } from "./store";
import {
  applyFullVisualBackup as applyLegacyFullVisualBackup,
  createFullVisualBackup as createLegacyFullVisualBackup,
  prepareFullVisualBackup as prepareLegacyFullVisualBackup,
  previewFullVisualBackupImport as previewLegacyFullVisualBackupImport,
  MAX_FULL_VISUAL_BACKUP_BYTES,
  MAX_FULL_VISUAL_BACKUP_UNCOMPRESSED_BYTES,
  type FullVisualBackupImportMode,
  type FullVisualBackupManifest,
  type PreparedFullVisualBackup as PreparedLegacyFullVisualBackup,
} from "./visual-backup";
import {
  getVisualSourceBackupSnapshot,
  replaceVisualSourceBackupSnapshot,
} from "./visual-source-store";

export const FULL_WORKSPACE_BACKUP_FORMAT = "lamdan-workspace-backup";
export const FULL_WORKSPACE_BACKUP_VERSION = 2;
export const MAX_FULL_WORKSPACE_BACKUP_BYTES = MAX_FULL_VISUAL_BACKUP_BYTES + 16 * 1024 * 1024;
export const MAX_FULL_WORKSPACE_BACKUP_UNCOMPRESSED_BYTES =
  MAX_FULL_VISUAL_BACKUP_UNCOMPRESSED_BYTES + 24 * 1024 * 1024;

const MANIFEST_PATH = "workspace-manifest.json";
const LEGACY_BACKUP_PATH = "workspace/visual-backup-v1.zip";
const CONCEPT_EVIDENCE_PATH = "workspace/concept-evidence.json";
const QUIZ_ATTEMPT_DETAILS_PATH = "workspace/quiz-attempt-details.json";

type WorkspaceBackupFileKind = "visualBackup" | "conceptEvidence" | "quizAttemptDetails";

export interface WorkspaceBackupFile {
  path: string;
  kind: WorkspaceBackupFileKind;
  size: number;
  sha256: string;
}

export interface WorkspaceBackupManifest {
  format: typeof FULL_WORKSPACE_BACKUP_FORMAT;
  version: typeof FULL_WORKSPACE_BACKUP_VERSION;
  createdAt: string;
  legacyVisualFormat: string;
  legacyVisualVersion: number;
  conceptEvidenceVersion: number;
  quizAttemptDetailsVersion: number;
  files: WorkspaceBackupFile[];
}

export interface FullVisualBackupExportResult {
  blob: Blob;
  manifest: WorkspaceBackupManifest;
  legacyManifest: FullVisualBackupManifest;
  skippedOrphanMaterialIds: string[];
}

export interface PreparedFullVisualBackup {
  source: "workspace-v2" | "legacy-v1";
  manifest?: WorkspaceBackupManifest;
  legacy: PreparedLegacyFullVisualBackup;
  conceptEvidence: ConceptEvidenceData;
  quizAttemptDetails: QuizAttemptDetailData;
  includesEvidence: boolean;
  warnings: string[];
  bytes: number;
}

export interface FullVisualBackupSummary {
  courses: number;
  materials: number;
  notes: number;
  flashcards: number;
  quizzes: number;
  images: number;
  processedImages: number;
  ocrDrafts: number;
  concepts: number;
  evidenceEvents: number;
  detailedAttempts: number;
  answerSnapshots: number;
  bytes: number;
}

export interface FullVisualBackupImportPreview {
  summary: FullVisualBackupSummary;
  warnings: string[];
  mergeConflicts: string[];
}

export interface FullVisualBackupApplyResult {
  mode: FullVisualBackupImportMode;
  summary: FullVisualBackupSummary;
  warnings: string[];
  conflicts: string[];
}

export interface WorkspaceEvidenceMergeResult {
  conceptEvidence: ConceptEvidenceData;
  quizAttemptDetails: QuizAttemptDetailData;
  conflicts: string[];
  warnings: string[];
}

export async function createFullVisualBackup(): Promise<FullVisualBackupExportResult> {
  const core = getDataSnapshot();
  const reconciledDetails = reconcileQuizAttemptDetailData(getQuizAttemptDetailSnapshot(), core);
  const reconciledConcepts = reconcileConceptEvidenceData(
    getConceptEvidenceSnapshot(),
    core,
    reconciledDetails,
  );
  const legacy = await createLegacyFullVisualBackup();
  const zip = new JSZip();
  const files: WorkspaceBackupFile[] = [];

  const legacyBytes = new Uint8Array(await legacy.blob.arrayBuffer());
  const conceptBytes = encodeJSON(reconciledConcepts);
  const detailBytes = encodeJSON(reconciledDetails);

  await addPayload(zip, files, LEGACY_BACKUP_PATH, "visualBackup", legacyBytes);
  await addPayload(zip, files, CONCEPT_EVIDENCE_PATH, "conceptEvidence", conceptBytes);
  await addPayload(zip, files, QUIZ_ATTEMPT_DETAILS_PATH, "quizAttemptDetails", detailBytes);

  const manifest: WorkspaceBackupManifest = {
    format: FULL_WORKSPACE_BACKUP_FORMAT,
    version: FULL_WORKSPACE_BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    legacyVisualFormat: legacy.manifest.format,
    legacyVisualVersion: legacy.manifest.version,
    conceptEvidenceVersion: reconciledConcepts.version,
    quizAttemptDetailsVersion: reconciledDetails.version,
    files,
  };
  zip.file(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  if (blob.size > MAX_FULL_WORKSPACE_BACKUP_BYTES) {
    throw new Error(
      `Workspace backup exceeds ${formatBytes(MAX_FULL_WORKSPACE_BACKUP_BYTES)} after compression.`,
    );
  }
  return {
    blob,
    manifest,
    legacyManifest: legacy.manifest,
    skippedOrphanMaterialIds: legacy.skippedOrphanMaterialIds,
  };
}

export async function prepareFullVisualBackup(file: Blob): Promise<PreparedFullVisualBackup> {
  if (file.size > MAX_FULL_WORKSPACE_BACKUP_BYTES) {
    throw new Error(
      `Backup is larger than the ${formatBytes(MAX_FULL_WORKSPACE_BACKUP_BYTES)} local safety limit.`,
    );
  }
  const zip = await JSZip.loadAsync(file, { checkCRC32: true });
  const manifestEntry = zip.file(MANIFEST_PATH);
  if (!manifestEntry) {
    const legacy = await prepareLegacyFullVisualBackup(file);
    return {
      source: "legacy-v1",
      legacy,
      conceptEvidence: emptyConceptEvidenceData(),
      quizAttemptDetails: emptyQuizAttemptDetailData(),
      includesEvidence: false,
      warnings: [
        ...legacy.warnings,
        "Legacy v1 archive has no concept graph or per-question answer history. Merge keeps current evidence; replace clears it.",
      ],
      bytes: file.size,
    };
  }

  const manifest = parseWorkspaceManifest(await manifestEntry.async("string"));
  validateArchiveEntries(zip, manifest);
  const uncompressedBytes = manifest.files.reduce((sum, entry) => sum + entry.size, 0);
  if (uncompressedBytes > MAX_FULL_WORKSPACE_BACKUP_UNCOMPRESSED_BYTES) {
    throw new Error(
      `Backup expands beyond the ${formatBytes(MAX_FULL_WORKSPACE_BACKUP_UNCOMPRESSED_BYTES)} safety limit.`,
    );
  }

  const payloads = new Map<WorkspaceBackupFileKind, Uint8Array>();
  for (const descriptor of manifest.files) {
    const entry = zip.file(descriptor.path);
    if (!entry) throw new Error(`Backup payload is missing: ${descriptor.path}`);
    const bytes = await entry.async("uint8array");
    if (bytes.byteLength !== descriptor.size) {
      throw new Error(`Backup size mismatch for ${descriptor.path}.`);
    }
    const actualHash = await sha256(bytes);
    if (actualHash !== descriptor.sha256) {
      throw new Error(`Backup checksum mismatch for ${descriptor.path}.`);
    }
    payloads.set(descriptor.kind, bytes);
  }

  const legacyBytes = requiredPayload(payloads, "visualBackup");
  const conceptBytes = requiredPayload(payloads, "conceptEvidence");
  const detailBytes = requiredPayload(payloads, "quizAttemptDetails");
  const legacy = await prepareLegacyFullVisualBackup(
    new Blob([toArrayBuffer(legacyBytes)], { type: "application/zip" }),
  );
  const rawConcept = parseJSONPayload(conceptBytes, CONCEPT_EVIDENCE_PATH);
  const rawDetails = parseJSONPayload(detailBytes, QUIZ_ATTEMPT_DETAILS_PATH);
  validateConceptEnvelope(rawConcept);
  validateAttemptDetailEnvelope(rawDetails);
  const normalizedDetails = normalizeQuizAttemptDetailData(rawDetails);
  const reconciledDetails = reconcileQuizAttemptDetailData(normalizedDetails, legacy.data);
  const normalizedConcepts = normalizeConceptEvidenceData(rawConcept);
  const reconciledConcepts = reconcileConceptEvidenceData(
    normalizedConcepts,
    legacy.data,
    reconciledDetails,
  );
  const warnings = [...legacy.warnings];
  const removedDetails = normalizedDetails.attempts.length - reconciledDetails.attempts.length;
  const removedConcepts = normalizedConcepts.concepts.length - reconciledConcepts.concepts.length;
  const removedEvents =
    normalizedConcepts.evidenceEvents.length - reconciledConcepts.evidenceEvents.length;
  if (removedDetails > 0) {
    warnings.push(`${removedDetails} detailed quiz attempt(s) were removed because the core attempt is missing.`);
  }
  if (removedConcepts > 0) {
    warnings.push(`${removedConcepts} concept(s) were removed because their course is missing.`);
  }
  if (removedEvents > 0) {
    warnings.push(`${removedEvents} evidence event(s) were removed because their links are invalid.`);
  }
  return {
    source: "workspace-v2",
    manifest,
    legacy,
    conceptEvidence: reconciledConcepts,
    quizAttemptDetails: reconciledDetails,
    includesEvidence: true,
    warnings,
    bytes: file.size,
  };
}

export async function previewFullVisualBackupImport(
  prepared: PreparedFullVisualBackup,
): Promise<FullVisualBackupImportPreview> {
  const legacyPreview = await previewLegacyFullVisualBackupImport(prepared.legacy);
  const currentConcepts = getConceptEvidenceSnapshot();
  const currentDetails = getQuizAttemptDetailSnapshot();
  const evidencePreview = prepared.includesEvidence
    ? mergeWorkspaceEvidenceSafely(
        currentConcepts,
        prepared.conceptEvidence,
        currentDetails,
        prepared.quizAttemptDetails,
        getDataSnapshot(),
      )
    : { conflicts: [], warnings: [] };
  return {
    summary: summarizePrepared(prepared, legacyPreview.summary),
    warnings: unique([...prepared.warnings, ...legacyPreview.warnings, ...evidencePreview.warnings]),
    mergeConflicts: unique([...legacyPreview.mergeConflicts, ...evidencePreview.conflicts]),
  };
}

export async function applyFullVisualBackup(
  prepared: PreparedFullVisualBackup,
  mode: FullVisualBackupImportMode,
): Promise<FullVisualBackupApplyResult> {
  const previousCore = getDataSnapshot();
  const previousVisual = await getVisualSourceBackupSnapshot();
  const previousConcepts = getConceptEvidenceSnapshot();
  const previousDetails = getQuizAttemptDetailSnapshot();
  try {
    const legacyResult = await applyLegacyFullVisualBackup(prepared.legacy, mode);
    const resultingCore = getDataSnapshot();
    const evidencePlan = buildEvidenceApplyPlan(
      mode,
      prepared,
      previousConcepts,
      previousDetails,
      resultingCore,
    );
    replaceQuizAttemptDetailData(evidencePlan.quizAttemptDetails);
    replaceConceptEvidenceVerified(evidencePlan.conceptEvidence);
    return {
      mode,
      summary: summarizePrepared(prepared, legacyResult.summary),
      warnings: unique([...prepared.warnings, ...legacyResult.warnings, ...evidencePlan.warnings]),
      conflicts: unique([...legacyResult.conflicts, ...evidencePlan.conflicts]),
    };
  } catch (error) {
    const rollbackErrors: string[] = [];
    try {
      await replaceVisualSourceBackupSnapshot(previousVisual);
    } catch (rollbackError) {
      rollbackErrors.push(`visual: ${messageOf(rollbackError)}`);
    }
    try {
      replaceAllAtomically(previousCore);
    } catch (rollbackError) {
      rollbackErrors.push(`core: ${messageOf(rollbackError)}`);
    }
    try {
      replaceQuizAttemptDetailData(previousDetails);
    } catch (rollbackError) {
      rollbackErrors.push(`attempt details: ${messageOf(rollbackError)}`);
    }
    try {
      replaceConceptEvidenceVerified(previousConcepts);
    } catch (rollbackError) {
      rollbackErrors.push(`concept evidence: ${messageOf(rollbackError)}`);
    }
    const rollbackSuffix = rollbackErrors.length
      ? ` Rollback errors: ${rollbackErrors.join("; ")}`
      : "";
    throw new Error(`Workspace backup import was rolled back: ${messageOf(error)}.${rollbackSuffix}`);
  }
}

export function mergeWorkspaceEvidenceSafely(
  currentConcepts: ConceptEvidenceData,
  incomingConcepts: ConceptEvidenceData,
  currentDetails: QuizAttemptDetailData,
  incomingDetails: QuizAttemptDetailData,
  core: AppData,
): WorkspaceEvidenceMergeResult {
  const conflicts: string[] = [];
  const warnings: string[] = [];

  const detailByAttempt = new Map(currentDetails.attempts.map((detail) => [detail.attemptId, detail]));
  for (const detail of incomingDetails.attempts) {
    if (detailByAttempt.has(detail.attemptId)) {
      conflicts.push(`quiz attempt detail: ${detail.attemptId}`);
      continue;
    }
    detailByAttempt.set(detail.attemptId, detail);
  }
  const mergedDetails = reconcileQuizAttemptDetailData(
    { version: 1, attempts: [...detailByAttempt.values()] },
    core,
  );
  const droppedDetails = detailByAttempt.size - mergedDetails.attempts.length;
  if (droppedDetails > 0) {
    warnings.push(`${droppedDetails} detailed attempt(s) were skipped because no matching core attempt exists.`);
  }

  const conceptById = new Map(currentConcepts.concepts.map((concept) => [concept.id, concept]));
  const blockedConceptIds = new Set<string>();
  for (const concept of incomingConcepts.concepts) {
    if (conceptById.has(concept.id)) {
      conflicts.push(`concept: ${concept.id}`);
      blockedConceptIds.add(concept.id);
      continue;
    }
    conceptById.set(concept.id, concept);
  }

  const eventById = new Map(currentConcepts.evidenceEvents.map((event) => [event.id, event]));
  for (const event of incomingConcepts.evidenceEvents) {
    if (blockedConceptIds.has(event.conceptId)) {
      warnings.push(`Evidence ${event.id} was skipped because concept ${event.conceptId} conflicted.`);
      continue;
    }
    if (eventById.has(event.id)) {
      conflicts.push(`evidence event: ${event.id}`);
      continue;
    }
    eventById.set(event.id, event);
  }
  const preReconcileConcepts: ConceptEvidenceData = {
    version: 1,
    concepts: [...conceptById.values()],
    evidenceEvents: [...eventById.values()],
  };
  const mergedConcepts = reconcileConceptEvidenceData(
    preReconcileConcepts,
    core,
    mergedDetails,
  );
  const droppedConcepts = preReconcileConcepts.concepts.length - mergedConcepts.concepts.length;
  const droppedEvents =
    preReconcileConcepts.evidenceEvents.length - mergedConcepts.evidenceEvents.length;
  if (droppedConcepts > 0) {
    warnings.push(`${droppedConcepts} concept(s) were skipped because their course is missing.`);
  }
  if (droppedEvents > 0) {
    warnings.push(`${droppedEvents} evidence event(s) were skipped because their links are invalid.`);
  }
  return {
    conceptEvidence: mergedConcepts,
    quizAttemptDetails: mergedDetails,
    conflicts,
    warnings,
  };
}

function buildEvidenceApplyPlan(
  mode: FullVisualBackupImportMode,
  prepared: PreparedFullVisualBackup,
  currentConcepts: ConceptEvidenceData,
  currentDetails: QuizAttemptDetailData,
  resultingCore: AppData,
): WorkspaceEvidenceMergeResult {
  if (mode === "merge") {
    if (!prepared.includesEvidence) {
      const details = reconcileQuizAttemptDetailData(currentDetails, resultingCore);
      return {
        quizAttemptDetails: details,
        conceptEvidence: reconcileConceptEvidenceData(currentConcepts, resultingCore, details),
        conflicts: [],
        warnings: ["Legacy merge preserved current concept and per-question evidence."],
      };
    }
    return mergeWorkspaceEvidenceSafely(
      currentConcepts,
      prepared.conceptEvidence,
      currentDetails,
      prepared.quizAttemptDetails,
      resultingCore,
    );
  }

  if (!prepared.includesEvidence) {
    return {
      conceptEvidence: emptyConceptEvidenceData(),
      quizAttemptDetails: emptyQuizAttemptDetailData(),
      conflicts: [],
      warnings: ["Legacy replace cleared concept and per-question evidence because the archive did not contain it."],
    };
  }
  const details = reconcileQuizAttemptDetailData(prepared.quizAttemptDetails, resultingCore);
  return {
    quizAttemptDetails: details,
    conceptEvidence: reconcileConceptEvidenceData(
      prepared.conceptEvidence,
      resultingCore,
      details,
    ),
    conflicts: [],
    warnings: [],
  };
}

function summarizePrepared(
  prepared: PreparedFullVisualBackup,
  legacySummary: {
    courses: number;
    materials: number;
    notes: number;
    flashcards: number;
    quizzes: number;
    images: number;
    processedImages: number;
    ocrDrafts: number;
    bytes: number;
  },
): FullVisualBackupSummary {
  return {
    ...legacySummary,
    concepts: prepared.conceptEvidence.concepts.length,
    evidenceEvents: prepared.conceptEvidence.evidenceEvents.length,
    detailedAttempts: prepared.quizAttemptDetails.attempts.length,
    answerSnapshots: prepared.quizAttemptDetails.attempts.reduce(
      (sum, attempt) => sum + attempt.answers.length,
      0,
    ),
    bytes: prepared.bytes || legacySummary.bytes,
  };
}

async function addPayload(
  zip: JSZip,
  files: WorkspaceBackupFile[],
  path: string,
  kind: WorkspaceBackupFileKind,
  bytes: Uint8Array,
): Promise<void> {
  zip.file(path, bytes);
  files.push({ path, kind, size: bytes.byteLength, sha256: await sha256(bytes) });
}

function parseWorkspaceManifest(json: string): WorkspaceBackupManifest {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (error) {
    throw new Error(`Workspace manifest is invalid JSON: ${messageOf(error)}`);
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Workspace manifest is not an object.");
  }
  const object = raw as Record<string, unknown>;
  if (object.format !== FULL_WORKSPACE_BACKUP_FORMAT) {
    throw new Error(`Unsupported backup format: ${String(object.format)}.`);
  }
  if (object.version !== FULL_WORKSPACE_BACKUP_VERSION) {
    throw new Error(`Unsupported workspace backup version: ${String(object.version)}.`);
  }
  if (!Array.isArray(object.files)) throw new Error("Workspace manifest has no files list.");
  const files = object.files.map(parseFileDescriptor);
  return {
    format: FULL_WORKSPACE_BACKUP_FORMAT,
    version: FULL_WORKSPACE_BACKUP_VERSION,
    createdAt: typeof object.createdAt === "string" ? object.createdAt : "",
    legacyVisualFormat:
      typeof object.legacyVisualFormat === "string" ? object.legacyVisualFormat : "",
    legacyVisualVersion: finiteInteger(object.legacyVisualVersion, 0),
    conceptEvidenceVersion: finiteInteger(object.conceptEvidenceVersion, 0),
    quizAttemptDetailsVersion: finiteInteger(object.quizAttemptDetailsVersion, 0),
    files,
  };
}

function parseFileDescriptor(raw: unknown): WorkspaceBackupFile {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Workspace manifest contains an invalid file descriptor.");
  }
  const object = raw as Record<string, unknown>;
  const path = typeof object.path === "string" ? object.path : "";
  const kind = object.kind as WorkspaceBackupFileKind;
  const size = finiteInteger(object.size, -1);
  const hash = typeof object.sha256 === "string" ? object.sha256.toLowerCase() : "";
  if (!safePath(path)) throw new Error(`Unsafe backup path: ${path || "(empty)"}.`);
  if (!["visualBackup", "conceptEvidence", "quizAttemptDetails"].includes(kind)) {
    throw new Error(`Unsupported workspace payload kind: ${String(object.kind)}.`);
  }
  if (size < 0) throw new Error(`Invalid payload size for ${path}.`);
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error(`Invalid SHA-256 for ${path}.`);
  return { path, kind, size, sha256: hash };
}

function validateArchiveEntries(zip: JSZip, manifest: WorkspaceBackupManifest): void {
  const expectedPathByKind: Record<WorkspaceBackupFileKind, string> = {
    visualBackup: LEGACY_BACKUP_PATH,
    conceptEvidence: CONCEPT_EVIDENCE_PATH,
    quizAttemptDetails: QUIZ_ATTEMPT_DETAILS_PATH,
  };
  const descriptors = new Map<WorkspaceBackupFileKind, WorkspaceBackupFile>();
  const paths = new Set<string>();
  for (const descriptor of manifest.files) {
    if (descriptors.has(descriptor.kind)) {
      throw new Error(`Duplicate workspace payload kind: ${descriptor.kind}.`);
    }
    if (paths.has(descriptor.path)) throw new Error(`Duplicate workspace payload path: ${descriptor.path}.`);
    if (descriptor.path !== expectedPathByKind[descriptor.kind]) {
      throw new Error(`Unexpected path for ${descriptor.kind}: ${descriptor.path}.`);
    }
    descriptors.set(descriptor.kind, descriptor);
    paths.add(descriptor.path);
  }
  for (const kind of Object.keys(expectedPathByKind) as WorkspaceBackupFileKind[]) {
    if (!descriptors.has(kind)) throw new Error(`Workspace backup is missing ${kind}.`);
  }
  const actualFiles = Object.values(zip.files)
    .filter((entry) => !entry.dir)
    .map((entry) => entry.name);
  const allowed = new Set([MANIFEST_PATH, ...paths]);
  for (const path of actualFiles) {
    if (!allowed.has(path)) throw new Error(`Unexpected file in workspace backup: ${path}.`);
  }
}

function validateConceptEnvelope(raw: unknown): void {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Concept evidence payload is not an object.");
  }
  const object = raw as Record<string, unknown>;
  if (object.version !== 1 || !Array.isArray(object.concepts) || !Array.isArray(object.evidenceEvents)) {
    throw new Error("Concept evidence payload has an unsupported schema.");
  }
}

function validateAttemptDetailEnvelope(raw: unknown): void {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Quiz attempt detail payload is not an object.");
  }
  const object = raw as Record<string, unknown>;
  if (object.version !== 1 || !Array.isArray(object.attempts)) {
    throw new Error("Quiz attempt detail payload has an unsupported schema.");
  }
}

function replaceConceptEvidenceVerified(next: ConceptEvidenceData): void {
  const normalized = normalizeConceptEvidenceData(next);
  if (typeof window !== "undefined") {
    const serialized = JSON.stringify(normalized);
    localStorage.setItem("lamdan.concept-evidence.v1", serialized);
    if (localStorage.getItem("lamdan.concept-evidence.v1") !== serialized) {
      throw new Error("Concept evidence could not be verified after saving.");
    }
  }
  conceptStore.replaceAll(normalized);
}

function requiredPayload(
  payloads: Map<WorkspaceBackupFileKind, Uint8Array>,
  kind: WorkspaceBackupFileKind,
): Uint8Array {
  const payload = payloads.get(kind);
  if (!payload) throw new Error(`Workspace payload is missing: ${kind}.`);
  return payload;
}

function parseJSONPayload(bytes: Uint8Array, path: string): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    throw new Error(`${path} is invalid JSON: ${messageOf(error)}`);
  }
}

function encodeJSON(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value, null, 2));
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", toArrayBuffer(bytes));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function safePath(path: string): boolean {
  return Boolean(path) && !path.startsWith("/") && !path.includes("\\") && !path.split("/").includes("..");
}

function finiteInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) ? value : fallback;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
