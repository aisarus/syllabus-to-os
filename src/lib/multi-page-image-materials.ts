import { countWords, type IngestChunk } from "./document-ingestion";
import { fingerprintFile, materialIdForFingerprint, rememberMaterialFingerprint } from "./material-fingerprints";
import { inferMaterialType, normalizeMaterialTitle } from "./material-intake";
import {
  normalizeOCRDraft,
  ocrDraftToChunks,
  validateOCRDraft,
  type OCRDraft,
} from "./ocr-contract";
import {
  getDataSnapshot,
  store,
  uid,
  updateData,
  type AppData,
  type Material,
  type MaterialChunk,
  type MaterialIntakeOptions as _Unused,
  type MaterialSourceLanguage,
  type MaterialType,
} from "./store";
import {
  deleteMaterialOCRDraft,
  deleteMaterialVisualData,
  isSupportedVisualSource,
  putMaterialVisualSource,
} from "./visual-source-store";

export const MULTI_PAGE_IMAGE_MIME = "application/x-lamdan-image-batch";
export const MULTI_PAGE_SECTION_PREFIX = "ocr:image-page:";
export const MAX_MULTI_PAGE_IMAGES = 50;

export type MultiPageVisualStatus =
  | "awaiting_ocr"
  | "recognizing"
  | "review"
  | "applied"
  | "error"
  | "cancelled";

export interface MultiPageVisualPage {
  id: string;
  order: number;
  fileName: string;
  mimeType: string;
  fileSize: number;
  fingerprint?: string;
  status: MultiPageVisualStatus;
  message?: string;
  sourceLanguage?: MaterialSourceLanguage;
  createdAt: number;
  updatedAt: number;
}

export interface MultiPageImageMaterial extends Material {
  visualPages: MultiPageVisualPage[];
}

export interface MultiPageCreateOptions {
  title?: string;
  type?: MaterialType;
  courseId?: string;
  topicId?: string;
  tags?: string[];
}

export interface MultiPageCreateResult {
  material: MultiPageImageMaterial;
  addedPages: MultiPageVisualPage[];
  skippedDuplicates: string[];
}

export function isMultiPageImageMaterial(
  material: Material | undefined | null,
): material is MultiPageImageMaterial {
  return Boolean(
    material &&
      material.mimeType === MULTI_PAGE_IMAGE_MIME &&
      Array.isArray((material as MultiPageImageMaterial).visualPages),
  );
}

export function getMultiPageVisualPages(material: Material): MultiPageVisualPage[] {
  if (!isMultiPageImageMaterial(material)) return [];
  return material.visualPages.slice().sort((left, right) => left.order - right.order);
}

export function getAllVisualSourceIds(data: Pick<AppData, "materials">): string[] {
  const ids = new Set<string>();
  for (const material of data.materials) {
    ids.add(material.id);
    if (isMultiPageImageMaterial(material)) {
      for (const page of material.visualPages) ids.add(page.id);
    }
  }
  return [...ids];
}

export function getVisualSourceIdsForMaterials(
  data: Pick<AppData, "materials">,
  materialIds: Iterable<string>,
): Set<string> {
  const requested = new Set(materialIds);
  const result = new Set<string>();
  for (const material of data.materials) {
    if (!requested.has(material.id)) continue;
    result.add(material.id);
    if (isMultiPageImageMaterial(material)) {
      for (const page of material.visualPages) result.add(page.id);
    }
  }
  return result;
}

export async function createMultiPageImageMaterial(
  files: Iterable<File>,
  options: MultiPageCreateOptions = {},
): Promise<MultiPageCreateResult> {
  const accepted = await prepareUniquePages(files);
  if (accepted.pages.length === 0) {
    throw new Error("No supported non-duplicate images were selected.");
  }

  const now = Date.now();
  const title = normalizeMaterialTitle(
    options.title,
    suggestedBatchTitle(accepted.pages.map((entry) => entry.file.name)),
  );
  const visualPages: MultiPageVisualPage[] = accepted.pages.map((entry, index) => ({
    id: uid("page"),
    order: index,
    fileName: entry.file.name,
    mimeType: entry.file.type,
    fileSize: entry.file.size,
    fingerprint: entry.fingerprint,
    status: "awaiting_ocr",
    message: "Stored locally; OCR has not been run yet.",
    createdAt: now,
    updatedAt: now,
  }));

  const material = store.createMaterial({
    title,
    type: options.type ?? inferMaterialType(accepted.pages.map((entry) => entry.file.name).join(" ")),
    sourceMode: "uploaded_file",
    fileName: `${visualPages.length} images`,
    mimeType: MULTI_PAGE_IMAGE_MIME,
    fileSize: visualPages.reduce((sum, page) => sum + page.fileSize, 0),
    courseId: options.courseId,
    topicId: options.topicId,
    tags: Array.from(new Set(options.tags?.map((tag) => tag.trim()).filter(Boolean) ?? [])),
    rawText: "",
    processingStatus: "no_text",
    processingMessage: `${visualPages.length} image pages stored; review OCR page by page.`,
    pageCount: visualPages.length,
    wordCount: 0,
    charCount: 0,
    sourceLanguage: "unknown",
    visualPages,
  } as Omit<MultiPageImageMaterial, "id" | "createdAt" | "updatedAt">) as MultiPageImageMaterial;

  const storedPageIds: string[] = [];
  try {
    for (let index = 0; index < accepted.pages.length; index += 1) {
      const entry = accepted.pages[index];
      const page = visualPages[index];
      await putMaterialVisualSource(page.id, entry.file);
      storedPageIds.push(page.id);
      rememberMaterialFingerprint(page.id, entry.fingerprint);
    }
  } catch (error) {
    await Promise.all(storedPageIds.map((pageId) => deleteMaterialVisualData(pageId)));
    store.deleteMaterial(material.id);
    throw error;
  }

  return {
    material,
    addedPages: visualPages,
    skippedDuplicates: accepted.skippedDuplicates,
  };
}

export async function appendMultiPageImages(
  materialId: string,
  files: Iterable<File>,
): Promise<MultiPageCreateResult> {
  const data = getDataSnapshot();
  const material = data.materials.find((entry) => entry.id === materialId);
  if (!isMultiPageImageMaterial(material)) throw new Error("Material is not a multi-page image set.");

  const accepted = await prepareUniquePages(files, data);
  const existingFingerprints = new Set(
    material.visualPages.map((page) => page.fingerprint).filter((value): value is string => Boolean(value)),
  );
  const newEntries = accepted.pages.filter((entry) => !entry.fingerprint || !existingFingerprints.has(entry.fingerprint));
  const skippedDuplicates = [
    ...accepted.skippedDuplicates,
    ...accepted.pages
      .filter((entry) => entry.fingerprint && existingFingerprints.has(entry.fingerprint))
      .map((entry) => entry.file.name),
  ];
  if (newEntries.length === 0) {
    return { material, addedPages: [], skippedDuplicates: Array.from(new Set(skippedDuplicates)) };
  }
  if (material.visualPages.length + newEntries.length > MAX_MULTI_PAGE_IMAGES) {
    throw new Error(`A multi-page material can contain at most ${MAX_MULTI_PAGE_IMAGES} images.`);
  }

  const now = Date.now();
  const addedPages: MultiPageVisualPage[] = newEntries.map((entry, index) => ({
    id: uid("page"),
    order: material.visualPages.length + index,
    fileName: entry.file.name,
    mimeType: entry.file.type,
    fileSize: entry.file.size,
    fingerprint: entry.fingerprint,
    status: "awaiting_ocr",
    message: "Stored locally; OCR has not been run yet.",
    createdAt: now,
    updatedAt: now,
  }));
  const stored: string[] = [];
  try {
    for (let index = 0; index < newEntries.length; index += 1) {
      await putMaterialVisualSource(addedPages[index].id, newEntries[index].file);
      stored.push(addedPages[index].id);
      rememberMaterialFingerprint(addedPages[index].id, newEntries[index].fingerprint);
    }
  } catch (error) {
    await Promise.all(stored.map((pageId) => deleteMaterialVisualData(pageId)));
    throw error;
  }

  const nextPages = [...material.visualPages, ...addedPages];
  store.updateMaterial(material.id, {
    visualPages: nextPages,
    pageCount: nextPages.length,
    fileSize: nextPages.reduce((sum, page) => sum + page.fileSize, 0),
    fileName: `${nextPages.length} images`,
    processingMessage: `${nextPages.length} image pages stored; some pages still need OCR review.`,
  } as Partial<MultiPageImageMaterial>);
  const nextMaterial = {
    ...material,
    visualPages: nextPages,
    pageCount: nextPages.length,
  } as MultiPageImageMaterial;
  return { material: nextMaterial, addedPages, skippedDuplicates: Array.from(new Set(skippedDuplicates)) };
}

export async function replaceMultiPageImage(
  materialId: string,
  pageId: string,
  file: File,
): Promise<void> {
  if (!isSupportedVisualSource(file)) throw new Error("Only JPEG, PNG and WebP images up to 20 MB are supported.");
  const fingerprint = await fingerprintFile(file);
  await putMaterialVisualSource(pageId, file);
  await deleteMaterialOCRDraft(pageId);
  removeChunksForVisualPage(materialId, pageId);
  updateMultiPageVisualPage(materialId, pageId, {
    fileName: file.name,
    mimeType: file.type,
    fileSize: file.size,
    fingerprint,
    status: "awaiting_ocr",
    message: "Image replaced; OCR must be run again.",
    sourceLanguage: undefined,
  });
  rememberMaterialFingerprint(pageId, fingerprint);
  refreshMultiPageMaterialAggregate(materialId);
}

export async function removeMultiPageImage(materialId: string, pageId: string): Promise<void> {
  removeChunksForVisualPage(materialId, pageId);
  updateData((data) => ({
    ...data,
    materials: data.materials.map((material) => {
      if (material.id !== materialId || !isMultiPageImageMaterial(material)) return material;
      const pages = material.visualPages
        .filter((page) => page.id !== pageId)
        .map((page, order) => ({ ...page, order, updatedAt: Date.now() }));
      return {
        ...material,
        visualPages: pages,
        pageCount: pages.length,
        fileName: `${pages.length} images`,
        fileSize: pages.reduce((sum, page) => sum + page.fileSize, 0),
        updatedAt: Date.now(),
      } as MultiPageImageMaterial;
    }),
  }));
  await deleteMaterialVisualData(pageId);
  reindexMultiPageChunkPageNumbers(materialId);
  refreshMultiPageMaterialAggregate(materialId);
}

export function reorderMultiPageImages(materialId: string, orderedPageIds: string[]): void {
  updateData((data) => ({
    ...data,
    materials: data.materials.map((material) => {
      if (material.id !== materialId || !isMultiPageImageMaterial(material)) return material;
      const byId = new Map(material.visualPages.map((page) => [page.id, page]));
      const ordered = orderedPageIds
        .map((pageId) => byId.get(pageId))
        .filter((page): page is MultiPageVisualPage => Boolean(page));
      const missing = material.visualPages.filter((page) => !orderedPageIds.includes(page.id));
      const pages = [...ordered, ...missing].map((page, order) => ({
        ...page,
        order,
        updatedAt: Date.now(),
      }));
      return { ...material, visualPages: pages, updatedAt: Date.now() } as MultiPageImageMaterial;
    }),
  }));
  reindexMultiPageChunkPageNumbers(materialId);
}

export function updateMultiPageVisualPage(
  materialId: string,
  pageId: string,
  patch: Partial<MultiPageVisualPage>,
): void {
  updateData((data) => ({
    ...data,
    materials: data.materials.map((material) => {
      if (material.id !== materialId || !isMultiPageImageMaterial(material)) return material;
      return {
        ...material,
        visualPages: material.visualPages.map((page) =>
          page.id === pageId ? { ...page, ...patch, updatedAt: Date.now() } : page,
        ),
        updatedAt: Date.now(),
      } as MultiPageImageMaterial;
    }),
  }));
}

export function setMultiPageVisualPageStatus(
  materialId: string,
  pageId: string,
  status: MultiPageVisualStatus,
  message?: string,
): void {
  updateMultiPageVisualPage(materialId, pageId, { status, message });
}

export async function applyOCRDraftToMultiPageImage(
  materialId: string,
  pageId: string,
  draft: OCRDraft,
  locale: "ru" | "en",
): Promise<number> {
  const normalized = normalizeOCRDraft(draft, { sourceStyle: draft.sourceStyle, locale });
  const validation = validateOCRDraft(normalized);
  if (!validation.valid || !normalized.text.trim()) {
    throw new Error(
      locale === "ru"
        ? "В черновике нет подтверждённого читаемого текста."
        : "The draft has no confirmed readable text.",
    );
  }
  const material = getDataSnapshot().materials.find((entry) => entry.id === materialId);
  if (!isMultiPageImageMaterial(material)) throw new Error("Material is not a multi-page image set.");
  const page = material.visualPages.find((entry) => entry.id === pageId);
  if (!page) throw new Error("Image page no longer exists.");
  const pageNumber = page.order + 1;
  const chunks = ocrDraftToChunks(normalized).map((chunk, index) => ({
    ...chunk,
    order: index,
    pageNumber,
    title: chunk.title ? `Page ${pageNumber} · ${chunk.title}` : `Page ${pageNumber}`,
    section: `${MULTI_PAGE_SECTION_PREFIX}${pageId}:${chunk.section ?? "ocr"}`,
  }));
  replaceChunksForVisualPage(materialId, pageId, chunks);
  updateMultiPageVisualPage(materialId, pageId, {
    status: "applied",
    message:
      normalized.warnings.length > 0
        ? normalized.warnings.join(" ")
        : locale === "ru"
          ? "OCR проверен и применён."
          : "OCR was reviewed and applied.",
    sourceLanguage: pickMaterialLanguage(normalized.languages),
  });
  refreshMultiPageMaterialAggregate(materialId);
  return chunks.length;
}

export function visualPageIdFromChunk(chunk: Pick<MaterialChunk, "section">): string | undefined {
  if (!chunk.section?.startsWith(MULTI_PAGE_SECTION_PREFIX)) return undefined;
  return chunk.section.slice(MULTI_PAGE_SECTION_PREFIX.length).split(":")[0] || undefined;
}

export function refreshMultiPageMaterialAggregate(materialId: string): void {
  const data = getDataSnapshot();
  const material = data.materials.find((entry) => entry.id === materialId);
  if (!isMultiPageImageMaterial(material)) return;
  const chunks = data.materialChunks
    .filter((chunk) => chunk.materialId === materialId && visualPageIdFromChunk(chunk))
    .slice()
    .sort((left, right) => (left.pageNumber ?? 0) - (right.pageNumber ?? 0) || left.order - right.order);
  const rawText = chunks.map((chunk) => chunk.text.trim()).filter(Boolean).join("\n\n");
  const applied = material.visualPages.filter((page) => page.status === "applied").length;
  const errors = material.visualPages.filter((page) => page.status === "error").length;
  const languages = Array.from(
    new Set(
      material.visualPages
        .map((page) => page.sourceLanguage)
        .filter((value): value is MaterialSourceLanguage => Boolean(value && value !== "unknown")),
    ),
  );
  const sourceLanguage: MaterialSourceLanguage =
    languages.length === 0 ? "unknown" : languages.length === 1 ? languages[0] : "mixed";
  store.updateMaterial(materialId, {
    rawText,
    pageCount: material.visualPages.length,
    wordCount: countWords(rawText),
    charCount: rawText.length,
    sourceLanguage,
    extractionMethod: "manual",
    processingStatus:
      applied === material.visualPages.length && material.visualPages.length > 0
        ? "ready"
        : applied > 0
          ? "partial"
          : errors > 0
            ? "error"
            : "no_text",
    processingMessage:
      applied === material.visualPages.length && material.visualPages.length > 0
        ? `All ${applied} image pages were reviewed and applied.`
        : `${applied}/${material.visualPages.length} image pages applied${errors ? `; ${errors} failed` : ""}.`,
  });
}

export function reindexMultiPageChunkPageNumbers(materialId: string): void {
  const data = getDataSnapshot();
  const material = data.materials.find((entry) => entry.id === materialId);
  if (!isMultiPageImageMaterial(material)) return;
  const numberByPageId = new Map(material.visualPages.map((page) => [page.id, page.order + 1]));
  for (const chunk of data.materialChunks.filter((entry) => entry.materialId === materialId)) {
    const pageId = visualPageIdFromChunk(chunk);
    const pageNumber = pageId ? numberByPageId.get(pageId) : undefined;
    if (!pageNumber || chunk.pageNumber === pageNumber) continue;
    store.updateMaterialChunk(chunk.id, {
      pageNumber,
      title: chunk.title?.replace(/^Page \d+/, `Page ${pageNumber}`),
    });
  }
}

function replaceChunksForVisualPage(
  materialId: string,
  pageId: string,
  chunks: IngestChunk[],
): void {
  removeChunksForVisualPage(materialId, pageId);
  for (const chunk of chunks) {
    store.createMaterialChunk({
      materialId,
      order: chunk.order,
      title: chunk.title,
      text: chunk.text,
      pageNumber: chunk.pageNumber,
      section: chunk.section,
    });
  }
}

function removeChunksForVisualPage(materialId: string, pageId: string): void {
  const data = getDataSnapshot();
  const chunkIds = data.materialChunks
    .filter(
      (chunk) => chunk.materialId === materialId && visualPageIdFromChunk(chunk) === pageId,
    )
    .map((chunk) => chunk.id);
  for (const chunkId of chunkIds) store.deleteMaterialChunk(chunkId);
}

async function prepareUniquePages(
  files: Iterable<File>,
  data: AppData = getDataSnapshot(),
): Promise<{
  pages: Array<{ file: File; fingerprint?: string }>;
  skippedDuplicates: string[];
}> {
  const input = Array.from(files);
  if (input.length > MAX_MULTI_PAGE_IMAGES) {
    throw new Error(`Select at most ${MAX_MULTI_PAGE_IMAGES} images at once.`);
  }
  const unsupported = input.filter((file) => !isSupportedVisualSource(file));
  if (unsupported.length > 0) {
    throw new Error(`Unsupported image files: ${unsupported.map((file) => file.name).join(", ")}`);
  }

  const knownFingerprints = new Set<string>();
  for (const material of data.materials) {
    if (!isMultiPageImageMaterial(material)) continue;
    for (const page of material.visualPages) {
      if (page.fingerprint) knownFingerprints.add(page.fingerprint);
    }
  }

  const pages: Array<{ file: File; fingerprint?: string }> = [];
  const skippedDuplicates: string[] = [];
  const batchFingerprints = new Set<string>();
  for (const file of input) {
    const fingerprint = await fingerprintFile(file);
    const indexedMaterialId = fingerprint ? materialIdForFingerprint(fingerprint) : undefined;
    if (
      fingerprint &&
      (batchFingerprints.has(fingerprint) || knownFingerprints.has(fingerprint) || indexedMaterialId)
    ) {
      skippedDuplicates.push(file.name);
      continue;
    }
    if (fingerprint) batchFingerprints.add(fingerprint);
    pages.push({ file, fingerprint });
  }
  return { pages, skippedDuplicates };
}

function suggestedBatchTitle(fileNames: string[]): string {
  if (fileNames.length === 0) return "Image material";
  const stems = fileNames.map((name) => name.replace(/\.[^.]+$/, "").trim()).filter(Boolean);
  const first = stems[0] || "Image material";
  const prefix = stems.reduce((current, value) => commonPrefix(current, value), first).replace(/[\s_-]+$/, "");
  return `${prefix.length >= 4 ? prefix : first} — ${fileNames.length} pages`;
}

function commonPrefix(left: string, right: string): string {
  const length = Math.min(left.length, right.length);
  let index = 0;
  while (index < length && left[index].toLowerCase() === right[index].toLowerCase()) index += 1;
  return left.slice(0, index);
}

function pickMaterialLanguage(languages: MaterialSourceLanguage[]): MaterialSourceLanguage {
  const meaningful = Array.from(new Set(languages.filter((language) => language !== "unknown")));
  if (meaningful.length === 0) return "unknown";
  if (meaningful.length === 1) return meaningful[0];
  return "mixed";
}
