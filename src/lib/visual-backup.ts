import JSZip from "jszip";
import { normalizeImageProcessingRecipe, imageProcessingRecipeKey } from "./image-preprocessing";
import {
  getAllVisualSourceIds,
  getMultiPageVisualPages,
  getVisualSourceIdsForMaterials,
  isMultiPageImageMaterial,
} from "./multi-page-image-materials";
import { normalizeOCRDraft } from "./ocr-contract";
import { getDataSnapshot, parseAppDataJSON, replaceAllAtomically, type AppData } from "./store";
import {
  getVisualSourceBackupSnapshot,
  replaceVisualSourceBackupSnapshot,
  type StoredImageProcessingState,
  type StoredOCRDraft,
  type StoredProcessedVisualSource,
  type StoredVisualSource,
  type VisualSourceBackupSnapshot,
} from "./visual-source-store";

export const FULL_VISUAL_BACKUP_FORMAT = "lamdan-full-backup";
export const FULL_VISUAL_BACKUP_VERSION = 1;
export const MAX_FULL_VISUAL_BACKUP_BYTES = 150 * 1024 * 1024;
export const MAX_FULL_VISUAL_BACKUP_UNCOMPRESSED_BYTES = 150 * 1024 * 1024;

type BackupFileKind = "data" | "image" | "ocr" | "processing" | "processedImage";

export interface FullVisualBackupFile {
  path: string;
  kind: BackupFileKind;
  size: number;
  sha256: string;
  materialId?: string;
  mimeType?: string;
  fileName?: string;
  createdAt?: number;
  updatedAt?: number;
  width?: number;
  height?: number;
  recipeKey?: string;
  sourceUpdatedAt?: number;
}

export interface FullVisualBackupMaterialMapping {
  materialId: string;
  imagePath?: string;
  ocrPath?: string;
  processingPath?: string;
  processedImagePath?: string;
}

export interface FullVisualBackupManifest {
  format: typeof FULL_VISUAL_BACKUP_FORMAT;
  version: typeof FULL_VISUAL_BACKUP_VERSION;
  createdAt: string;
  appDataVersion: number;
  files: FullVisualBackupFile[];
  materials: FullVisualBackupMaterialMapping[];
}

export interface FullVisualBackupExportResult {
  blob: Blob;
  manifest: FullVisualBackupManifest;
  skippedOrphanMaterialIds: string[];
}

export interface PreparedFullVisualBackup {
  manifest: FullVisualBackupManifest;
  data: AppData;
  visual: VisualSourceBackupSnapshot;
  warnings: string[];
}

export type FullVisualBackupImportMode = "replace" | "merge";

export interface FullVisualBackupSummary {
  courses: number;
  materials: number;
  notes: number;
  flashcards: number;
  quizzes: number;
  images: number;
  processedImages: number;
  ocrDrafts: number;
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

interface BackupPlan {
  data: AppData;
  visual: VisualSourceBackupSnapshot;
  conflicts: string[];
  warnings: string[];
}

/**
 * Produces a portable ZIP without replacing any in-browser data. Every
 * top-level material and every page-level visual source from a multi-page
 * material is a valid manifest mapping.
 */
export async function createFullVisualBackup(): Promise<FullVisualBackupExportResult> {
  const [data, visual] = await Promise.all([getDataSnapshot(), getVisualSourceBackupSnapshot()]);
  const visualSourceIds = new Set(getAllVisualSourceIds(data));
  const zip = new JSZip();
  const files: FullVisualBackupFile[] = [];
  const mappings = new Map<string, FullVisualBackupMaterialMapping>();
  const orphanIds = new Set<string>();

  const mappingFor = (materialId: string) => {
    const existing = mappings.get(materialId);
    if (existing) return existing;
    const next: FullVisualBackupMaterialMapping = { materialId };
    mappings.set(materialId, next);
    return next;
  };

  const addFile = async (
    descriptor: Omit<FullVisualBackupFile, "size" | "sha256">,
    content: Blob | string,
  ) => {
    const blob =
      typeof content === "string" ? new Blob([content], { type: "application/json" }) : content;
    zip.file(descriptor.path, blob);
    files.push({ ...descriptor, size: blob.size, sha256: await sha256(blob) });
  };

  const dataText = JSON.stringify(data, null, 2);
  await addFile({ path: "data.json", kind: "data" }, dataText);

  const images = visual.images.filter((image) => {
    if (visualSourceIds.has(image.materialId)) return true;
    orphanIds.add(image.materialId);
    return false;
  });
  const imageMaterialIds = new Set(images.map((image) => image.materialId));

  for (const image of images) {
    const path = `images/${fileSafeMaterialId(image.materialId)}.${extensionForMime(image.mimeType)}`;
    await addFile(
      {
        path,
        kind: "image",
        materialId: image.materialId,
        mimeType: image.mimeType,
        fileName: image.fileName,
        createdAt: image.createdAt,
        updatedAt: image.updatedAt,
      },
      image.blob,
    );
    mappingFor(image.materialId).imagePath = path;
  }

  for (const record of visual.ocrDrafts) {
    if (!visualSourceIds.has(record.materialId)) {
      orphanIds.add(record.materialId);
      continue;
    }
    const path = `ocr/${fileSafeMaterialId(record.materialId)}.json`;
    await addFile(
      {
        path,
        kind: "ocr",
        materialId: record.materialId,
        updatedAt: record.updatedAt,
      },
      JSON.stringify(record),
    );
    mappingFor(record.materialId).ocrPath = path;
  }

  for (const record of visual.imageProcessing) {
    if (!imageMaterialIds.has(record.materialId)) {
      orphanIds.add(record.materialId);
      continue;
    }
    const path = `processing/${fileSafeMaterialId(record.materialId)}.json`;
    await addFile(
      {
        path,
        kind: "processing",
        materialId: record.materialId,
        updatedAt: record.updatedAt,
        sourceUpdatedAt: record.sourceUpdatedAt,
      },
      JSON.stringify(record),
    );
    mappingFor(record.materialId).processingPath = path;
  }

  for (const image of visual.processedImages) {
    if (!imageMaterialIds.has(image.materialId)) {
      orphanIds.add(image.materialId);
      continue;
    }
    const path = `processed/${fileSafeMaterialId(image.materialId)}.${extensionForMime(image.mimeType)}`;
    await addFile(
      {
        path,
        kind: "processedImage",
        materialId: image.materialId,
        mimeType: image.mimeType,
        fileName: image.fileName,
        createdAt: image.createdAt,
        updatedAt: image.updatedAt,
        width: image.width,
        height: image.height,
        recipeKey: image.recipeKey,
        sourceUpdatedAt: image.sourceUpdatedAt,
      },
      image.blob,
    );
    mappingFor(image.materialId).processedImagePath = path;
  }

  const manifest: FullVisualBackupManifest = {
    format: FULL_VISUAL_BACKUP_FORMAT,
    version: FULL_VISUAL_BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    appDataVersion: data.version,
    files,
    materials: [...mappings.values()].sort((left, right) =>
      left.materialId.localeCompare(right.materialId),
    ),
  };
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  return { blob, manifest, skippedOrphanMaterialIds: [...orphanIds].sort() };
}

/** Reads and verifies the entire archive before any browser data can change. */
export async function prepareFullVisualBackup(file: Blob): Promise<PreparedFullVisualBackup> {
  if (file.size <= 0) throw new Error("The full backup archive is empty.");
  if (file.size > MAX_FULL_VISUAL_BACKUP_BYTES) {
    throw new Error("The full backup archive exceeds the 150 MB local safety limit.");
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file, { checkCRC32: true });
  } catch (error) {
    throw new Error(`Could not open the full backup ZIP: ${readableError(error)}`);
  }

  const manifestText = await readZipText(zip, "manifest.json");
  const manifest = parseManifest(manifestText);
  const entries = new Map<string, Blob>();
  for (const descriptor of manifest.files) {
    const entry = zip.file(descriptor.path);
    if (!entry) throw new Error(`Backup payload is missing: ${descriptor.path}`);
    const blob = await entry.async("blob");
    if (blob.size !== descriptor.size) {
      throw new Error(`Backup payload size does not match its manifest: ${descriptor.path}`);
    }
    if ((await sha256(blob)) !== descriptor.sha256) {
      throw new Error(`Backup payload checksum mismatch: ${descriptor.path}`);
    }
    entries.set(descriptor.path, blob);
  }

  const dataDescriptor = manifest.files.find((descriptor) => descriptor.kind === "data");
  if (!dataDescriptor) throw new Error("The full backup manifest has no data.json payload.");
  const parsedData = parseAppDataJSON(await blobText(entries.get(dataDescriptor.path)));
  if (!parsedData.ok) throw new Error(`The full backup text data is invalid: ${parsedData.error}`);

  const decoded = await decodeVisualPayloads(manifest, entries, parsedData.data);
  return { manifest, data: parsedData.data, visual: decoded.visual, warnings: decoded.warnings };
}

export async function previewFullVisualBackupImport(
  prepared: PreparedFullVisualBackup,
): Promise<FullVisualBackupImportPreview> {
  const [currentData, currentVisual] = await Promise.all([
    getDataSnapshot(),
    getVisualSourceBackupSnapshot(),
  ]);
  const mergePlan = buildImportPlan("merge", prepared, currentData, currentVisual);
  return {
    summary: {
      ...summarizeBackup(prepared.data, prepared.visual),
      bytes: prepared.manifest.files.reduce((total, file) => total + file.size, 0),
    },
    warnings: [...prepared.warnings],
    mergeConflicts: mergePlan.conflicts,
  };
}

/** Applies a validated archive and rolls text and visual stores back together. */
export async function applyFullVisualBackup(
  prepared: PreparedFullVisualBackup,
  mode: FullVisualBackupImportMode,
): Promise<FullVisualBackupApplyResult> {
  const [previousData, previousVisual] = await Promise.all([
    getDataSnapshot(),
    getVisualSourceBackupSnapshot(),
  ]);
  const plan = buildImportPlan(mode, prepared, previousData, previousVisual);
  try {
    await replaceVisualSourceBackupSnapshot(plan.visual);
    replaceAllAtomically(plan.data);
  } catch (error) {
    try {
      await replaceVisualSourceBackupSnapshot(previousVisual);
      replaceAllAtomically(previousData);
    } catch (rollbackError) {
      throw new Error(
        `Import failed and rollback also failed. Import: ${readableError(error)}. Rollback: ${readableError(rollbackError)}`,
      );
    }
    throw new Error(`Full backup import was rolled back: ${readableError(error)}`);
  }
  return {
    mode,
    summary: summarizeBackup(plan.data, plan.visual),
    warnings: plan.warnings,
    conflicts: plan.conflicts,
  };
}

function buildImportPlan(
  mode: FullVisualBackupImportMode,
  prepared: PreparedFullVisualBackup,
  currentData: AppData,
  currentVisual: VisualSourceBackupSnapshot,
): BackupPlan {
  if (mode === "replace") {
    return {
      data: cloneData(prepared.data),
      visual: cloneVisualSnapshot(prepared.visual),
      conflicts: [],
      warnings: [...prepared.warnings],
    };
  }

  const appMerge = mergeAppDataSafely(currentData, prepared.data);
  const blockedVisualSourceIds = getVisualSourceIdsForMaterials(
    prepared.data,
    appMerge.blockedMaterialIds,
  );
  const visualMerge = mergeVisualSnapshotSafely(
    currentVisual,
    prepared.visual,
    blockedVisualSourceIds,
  );
  return {
    data: appMerge.data,
    visual: visualMerge.visual,
    conflicts: [...appMerge.conflicts, ...visualMerge.conflicts],
    warnings: [...prepared.warnings, ...visualMerge.warnings],
  };
}

function mergeAppDataSafely(
  current: AppData,
  incoming: AppData,
): { data: AppData; conflicts: string[]; blockedMaterialIds: Set<string> } {
  const data = cloneData(current);
  const conflicts: string[] = [];
  const currentMaterialIds = new Set(current.materials.map((material) => material.id));
  const blockedMaterialIds = new Set(
    incoming.materials
      .map((material) => material.id)
      .filter((materialId) => currentMaterialIds.has(materialId)),
  );
  const currentQuizIds = new Set(current.quizzes.map((quiz) => quiz.id));
  const blockedQuizIds = new Set(
    incoming.quizzes.map((quiz) => quiz.id).filter((quizId) => currentQuizIds.has(quizId)),
  );
  const filtered = cloneData(incoming);

  filtered.materialChunks = filtered.materialChunks.filter(
    (chunk) => !blockedMaterialIds.has(chunk.materialId),
  );
  filtered.materialOutputs = filtered.materialOutputs.filter(
    (output) => !blockedMaterialIds.has(output.materialId),
  );
  filtered.notes = filtered.notes.filter(
    (note) => !note.materialId || !blockedMaterialIds.has(note.materialId),
  );
  filtered.flashcards = filtered.flashcards.filter(
    (card) => !card.materialId || !blockedMaterialIds.has(card.materialId),
  );
  filtered.quizzes = filtered.quizzes.filter(
    (quiz) => !quiz.materialId || !blockedMaterialIds.has(quiz.materialId),
  );
  filtered.presentationOutlines = filtered.presentationOutlines.filter(
    (outline) => !outline.materialId || !blockedMaterialIds.has(outline.materialId),
  );
  filtered.quizQuestions = filtered.quizQuestions.filter(
    (question) => !blockedQuizIds.has(question.quizId),
  );
  filtered.quizAttempts = filtered.quizAttempts.filter(
    (attempt) => !blockedQuizIds.has(attempt.quizId),
  );

  for (const [key, label] of collectionDescriptors) {
    const target = data[key] as unknown as Array<{ id: string }>;
    const source = filtered[key] as unknown as Array<{ id: string }>;
    const ids = new Set(target.map((record) => record.id));
    for (const record of source) {
      if (ids.has(record.id)) {
        conflicts.push(`${label}: ${record.id}`);
        continue;
      }
      ids.add(record.id);
      target.push(record);
    }
  }

  for (const materialId of blockedMaterialIds) conflicts.push(`material source: ${materialId}`);
  return { data, conflicts: unique(conflicts), blockedMaterialIds };
}

function mergeVisualSnapshotSafely(
  current: VisualSourceBackupSnapshot,
  incoming: VisualSourceBackupSnapshot,
  blockedVisualSourceIds: Set<string>,
): { visual: VisualSourceBackupSnapshot; conflicts: string[]; warnings: string[] } {
  const visual = cloneVisualSnapshot(current);
  const existingMaterialIds = new Set(
    [
      ...current.images,
      ...current.ocrDrafts,
      ...current.imageProcessing,
      ...current.processedImages,
    ].map((record) => record.materialId),
  );
  const incomingMaterialIds = new Set(
    [
      ...incoming.images,
      ...incoming.ocrDrafts,
      ...incoming.imageProcessing,
      ...incoming.processedImages,
    ].map((record) => record.materialId),
  );
  const blocked = new Set([...existingMaterialIds, ...blockedVisualSourceIds]);
  const conflicts = [...incomingMaterialIds]
    .filter((materialId) => blocked.has(materialId))
    .map((materialId) => `visual source: ${materialId}`);
  const accepted = (materialId: string) => !blocked.has(materialId);

  visual.images.push(...incoming.images.filter((record) => accepted(record.materialId)));
  visual.ocrDrafts.push(...incoming.ocrDrafts.filter((record) => accepted(record.materialId)));
  visual.imageProcessing.push(
    ...incoming.imageProcessing.filter((record) => accepted(record.materialId)),
  );
  visual.processedImages.push(
    ...incoming.processedImages.filter((record) => accepted(record.materialId)),
  );
  return { visual, conflicts, warnings: [] };
}

async function decodeVisualPayloads(
  manifest: FullVisualBackupManifest,
  entries: Map<string, Blob>,
  data: AppData,
): Promise<{ visual: VisualSourceBackupSnapshot; warnings: string[] }> {
  const warnings: string[] = [];
  const visualSourceIds = new Set(getAllVisualSourceIds(data));
  const images: StoredVisualSource[] = [];
  const drafts: StoredOCRDraft[] = [];
  const rawProcessing: StoredImageProcessingState[] = [];
  const rawProcessed: StoredProcessedVisualSource[] = [];
  const seen = new Map<BackupFileKind, Set<string>>();
  for (const kind of ["image", "ocr", "processing", "processedImage"] as const) {
    seen.set(kind, new Set());
  }

  for (const descriptor of manifest.files) {
    if (descriptor.kind === "data") continue;
    const materialId = requireMaterialId(descriptor);
    if (seen.get(descriptor.kind)?.has(materialId)) {
      throw new Error(`Backup has more than one ${descriptor.kind} payload for ${materialId}.`);
    }
    seen.get(descriptor.kind)?.add(materialId);
    if (!visualSourceIds.has(materialId)) {
      warnings.push(`Skipped visual payload without a material or image page: ${materialId}.`);
      continue;
    }
    const blob = entries.get(descriptor.path);
    if (!blob) throw new Error(`Validated backup payload disappeared: ${descriptor.path}`);

    if (descriptor.kind === "image") {
      images.push({
        materialId,
        fileName: requireString(descriptor.fileName, `image file name for ${materialId}`),
        mimeType: requireImageMime(descriptor.mimeType, materialId),
        size: blob.size,
        blob,
        createdAt: timestampOrNow(descriptor.createdAt),
        updatedAt: timestampOrNow(descriptor.updatedAt),
      });
      continue;
    }

    if (descriptor.kind === "ocr") {
      const raw = parseJson(await blobText(blob), `OCR draft for ${materialId}`);
      if (!isRecord(raw) || raw.materialId !== materialId || !isRecord(raw.draft)) {
        throw new Error(`OCR draft payload does not match ${materialId}.`);
      }
      const sourceStyle = raw.draft.sourceStyle;
      const draft = normalizeOCRDraft(raw.draft, {
        sourceStyle:
          sourceStyle === "printed" ||
          sourceStyle === "handwritten" ||
          sourceStyle === "whiteboard" ||
          sourceStyle === "mixed"
            ? sourceStyle
            : "mixed",
      });
      drafts.push({
        materialId,
        draft,
        updatedAt: timestampOrNow(raw.updatedAt ?? descriptor.updatedAt),
      });
      continue;
    }

    if (descriptor.kind === "processing") {
      const raw = parseJson(await blobText(blob), `processing recipe for ${materialId}`);
      if (!isRecord(raw) || raw.materialId !== materialId) {
        throw new Error(`Processing payload does not match ${materialId}.`);
      }
      rawProcessing.push({
        materialId,
        recipe: normalizeImageProcessingRecipe(isRecord(raw.recipe) ? raw.recipe : undefined),
        selectedSource: raw.selectedSource === "processed" ? "processed" : "original",
        sourceUpdatedAt: requirePositiveTimestamp(raw.sourceUpdatedAt, materialId),
        updatedAt: timestampOrNow(raw.updatedAt ?? descriptor.updatedAt),
      });
      continue;
    }

    rawProcessed.push({
      materialId,
      fileName: requireString(descriptor.fileName, `processed image file name for ${materialId}`),
      mimeType: requireImageMime(descriptor.mimeType, materialId),
      size: blob.size,
      blob,
      width: requirePositiveNumber(descriptor.width, `processed image width for ${materialId}`),
      height: requirePositiveNumber(descriptor.height, `processed image height for ${materialId}`),
      recipeKey: requireString(descriptor.recipeKey, `processed recipe key for ${materialId}`),
      sourceUpdatedAt: requirePositiveTimestamp(descriptor.sourceUpdatedAt, materialId),
      createdAt: timestampOrNow(descriptor.createdAt),
      updatedAt: timestampOrNow(descriptor.updatedAt),
    });
  }

  const originalsByMaterial = new Map(images.map((image) => [image.materialId, image]));
  const processingByMaterial = new Map<string, StoredImageProcessingState>();
  for (const processing of rawProcessing) {
    const original = originalsByMaterial.get(processing.materialId);
    if (!original || original.updatedAt !== processing.sourceUpdatedAt) {
      warnings.push(
        `Skipped processing recipe with no matching original image: ${processing.materialId}.`,
      );
      continue;
    }
    processingByMaterial.set(processing.materialId, processing);
  }

  const processedImages: StoredProcessedVisualSource[] = [];
  const processedByMaterial = new Set<string>();
  for (const processed of rawProcessed) {
    const processing = processingByMaterial.get(processed.materialId);
    const original = originalsByMaterial.get(processed.materialId);
    if (
      !processing ||
      !original ||
      processed.sourceUpdatedAt !== original.updatedAt ||
      processed.sourceUpdatedAt !== processing.sourceUpdatedAt ||
      processed.recipeKey !== imageProcessingRecipeKey(processing.recipe)
    ) {
      warnings.push(`Skipped stale processed preview: ${processed.materialId}.`);
      continue;
    }
    processedImages.push(processed);
    processedByMaterial.add(processed.materialId);
  }

  const imageProcessing = [...processingByMaterial.values()].map((processing) => {
    if (
      processing.selectedSource === "processed" &&
      !processedByMaterial.has(processing.materialId)
    ) {
      warnings.push(
        `Processed source was unavailable; restored original selection: ${processing.materialId}.`,
      );
      return { ...processing, selectedSource: "original" as const };
    }
    return processing;
  });

  for (const material of data.materials) {
    if (material.mimeType?.startsWith("image/") && !originalsByMaterial.has(material.id)) {
      warnings.push(`Source image is missing for material: ${material.title || material.id}.`);
    }
    if (isMultiPageImageMaterial(material)) {
      for (const page of getMultiPageVisualPages(material)) {
        if (!originalsByMaterial.has(page.id)) {
          warnings.push(
            `Source image is missing for page ${page.order + 1} of ${material.title || material.id}.`,
          );
        }
      }
    }
  }
  for (const draft of drafts) {
    if (!originalsByMaterial.has(draft.materialId)) {
      warnings.push(`OCR draft restored without a source image: ${draft.materialId}.`);
    }
  }

  return {
    visual: { images, ocrDrafts: drafts, imageProcessing, processedImages },
    warnings: unique(warnings),
  };
}

function parseManifest(text: string): FullVisualBackupManifest {
  const raw = parseJson(text, "manifest");
  if (!isRecord(raw)) throw new Error("Backup manifest is not an object.");
  if (raw.format !== FULL_VISUAL_BACKUP_FORMAT) throw new Error("Unsupported backup format.");
  if (raw.version !== FULL_VISUAL_BACKUP_VERSION) throw new Error("Unsupported backup version.");
  if (!Array.isArray(raw.files) || !Array.isArray(raw.materials)) {
    throw new Error("Backup manifest is missing files or material mappings.");
  }

  const files = raw.files as FullVisualBackupFile[];
  const paths = new Set<string>();
  const descriptorsByPath = new Map<string, FullVisualBackupFile>();
  let dataCount = 0;
  let uncompressedBytes = 0;
  for (const descriptor of files) {
    if (!isRecord(descriptor) || !isBackupFileKind(descriptor.kind)) {
      throw new Error("Backup manifest has an unsupported file descriptor.");
    }
    if (!isSafeArchivePath(descriptor.path) || paths.has(descriptor.path)) {
      throw new Error(
        `Backup manifest has an unsafe or duplicate path: ${String(descriptor.path)}.`,
      );
    }
    if (!isExpectedPayloadPath(descriptor.kind, descriptor.path)) {
      throw new Error(`Backup manifest has an unexpected payload path: ${descriptor.path}.`);
    }
    if (!Number.isInteger(descriptor.size) || descriptor.size < 0 || !isSha256(descriptor.sha256)) {
      throw new Error(`Backup manifest has invalid integrity metadata: ${descriptor.path}.`);
    }
    uncompressedBytes += descriptor.size;
    if (uncompressedBytes > MAX_FULL_VISUAL_BACKUP_UNCOMPRESSED_BYTES) {
      throw new Error("The full backup payloads exceed the 150 MB local safety limit.");
    }
    if (descriptor.kind === "data") {
      dataCount += 1;
      if (descriptor.path !== "data.json" || descriptor.materialId) {
        throw new Error("Backup data payload must be data.json without a material id.");
      }
    } else {
      requireMaterialId(descriptor);
    }
    paths.add(descriptor.path);
    descriptorsByPath.set(descriptor.path, descriptor);
  }
  if (dataCount !== 1) throw new Error("Backup manifest must contain exactly one data.json payload.");

  const materials = raw.materials as FullVisualBackupMaterialMapping[];
  const mappingIds = new Set<string>();
  for (const mapping of materials) {
    if (!isRecord(mapping) || typeof mapping.materialId !== "string" || !mapping.materialId) {
      throw new Error("Backup manifest has an invalid material mapping.");
    }
    if (mappingIds.has(mapping.materialId)) {
      throw new Error(`Backup manifest has duplicate material mapping: ${mapping.materialId}.`);
    }
    for (const path of [
      [mapping.imagePath, "image"],
      [mapping.ocrPath, "ocr"],
      [mapping.processingPath, "processing"],
      [mapping.processedImagePath, "processedImage"],
    ]) {
      const [payloadPath, expectedKind] = path;
      if (!payloadPath) continue;
      const descriptor = descriptorsByPath.get(payloadPath);
      if (
        !descriptor ||
        descriptor.materialId !== mapping.materialId ||
        descriptor.kind !== expectedKind
      ) {
        throw new Error(`Backup mapping references an invalid payload: ${payloadPath}.`);
      }
    }
    mappingIds.add(mapping.materialId);
  }

  for (const descriptor of files) {
    if (descriptor.kind === "data") continue;
    const mapping = materials.find((item) => item.materialId === descriptor.materialId);
    const isMapped =
      mapping?.imagePath === descriptor.path ||
      mapping?.ocrPath === descriptor.path ||
      mapping?.processingPath === descriptor.path ||
      mapping?.processedImagePath === descriptor.path;
    if (!isMapped) {
      throw new Error(`Backup payload is missing a material mapping: ${descriptor.path}.`);
    }
  }

  return {
    format: FULL_VISUAL_BACKUP_FORMAT,
    version: FULL_VISUAL_BACKUP_VERSION,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : "",
    appDataVersion: typeof raw.appDataVersion === "number" ? raw.appDataVersion : 1,
    files,
    materials,
  };
}

const collectionDescriptors = [
  ["programs", "program"],
  ["courses", "course"],
  ["topics", "topic"],
  ["notes", "note"],
  ["flashcards", "flashcard"],
  ["quizzes", "quiz"],
  ["quizQuestions", "quiz question"],
  ["quizAttempts", "quiz attempt"],
  ["assignments", "assignment"],
  ["materials", "material"],
  ["materialChunks", "material chunk"],
  ["materialOutputs", "material output"],
  ["presentationOutlines", "presentation outline"],
  ["calendarEvents", "calendar event"],
  ["studySessions", "study session"],
  ["syllabusImports", "syllabus import"],
] as const satisfies ReadonlyArray<readonly [keyof AppData, string]>;

function summarizeBackup(
  data: AppData,
  visual: VisualSourceBackupSnapshot,
): FullVisualBackupSummary {
  return {
    courses: data.courses.length,
    materials: data.materials.length,
    notes: data.notes.length,
    flashcards: data.flashcards.length,
    quizzes: data.quizzes.length,
    images: visual.images.length,
    processedImages: visual.processedImages.length,
    ocrDrafts: visual.ocrDrafts.length,
    bytes:
      visual.images.reduce((sum, image) => sum + image.size, 0) +
      visual.processedImages.reduce((sum, image) => sum + image.size, 0),
  };
}

function cloneData(data: AppData): AppData {
  return JSON.parse(JSON.stringify(data)) as AppData;
}

function cloneVisualSnapshot(snapshot: VisualSourceBackupSnapshot): VisualSourceBackupSnapshot {
  return {
    images: snapshot.images.slice(),
    ocrDrafts: snapshot.ocrDrafts.slice(),
    imageProcessing: snapshot.imageProcessing.slice(),
    processedImages: snapshot.processedImages.slice(),
  };
}

async function readZipText(zip: JSZip, path: string): Promise<string> {
  const entry = zip.file(path);
  if (!entry) throw new Error(`Backup payload is missing: ${path}`);
  return entry.async("string");
}

async function sha256(blob: Blob): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("SHA-256 validation requires Web Crypto in this browser.");
  }
  const digest = await globalThis.crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fileSafeMaterialId(materialId: string): string {
  return encodeURIComponent(materialId).replace(/%/g, "_");
}

function extensionForMime(mimeType: string): string {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "bin";
}

function parseJson(text: string, label: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Could not parse ${label}: ${readableError(error)}`);
  }
}

function blobText(blob: Blob | undefined): Promise<string> {
  if (!blob) throw new Error("Validated backup payload is missing.");
  return blob.text();
}

function requireMaterialId(descriptor: FullVisualBackupFile): string {
  return requireString(descriptor.materialId, `material id for ${descriptor.path}`);
}

function requireImageMime(value: unknown, materialId: string): string {
  if (value === "image/jpeg" || value === "image/png" || value === "image/webp") return value;
  throw new Error(`Unsupported image mime type for ${materialId}.`);
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Missing ${label}.`);
  return value;
}

function requirePositiveNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid ${label}.`);
  }
  return value;
}

function requirePositiveTimestamp(value: unknown, materialId: string): number {
  return requirePositiveNumber(value, `source timestamp for ${materialId}`);
}

function timestampOrNow(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : Date.now();
}

function isBackupFileKind(value: unknown): value is BackupFileKind {
  return (
    value === "data" ||
    value === "image" ||
    value === "ocr" ||
    value === "processing" ||
    value === "processedImage"
  );
}

function isSafeArchivePath(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    !value.startsWith("/") &&
    !value.includes("\\") &&
    !value.split("/").includes("..")
  );
}

function isExpectedPayloadPath(kind: BackupFileKind, path: string): boolean {
  if (kind === "data") return path === "data.json";
  if (kind === "image") return path.startsWith("images/");
  if (kind === "ocr") return path.startsWith("ocr/") && path.endsWith(".json");
  if (kind === "processing") return path.startsWith("processing/") && path.endsWith(".json");
  return path.startsWith("processed/");
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
