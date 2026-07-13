import type { OCRDraft } from "./ocr-contract";
import {
  imageProcessingRecipeKey,
  normalizeImageProcessingRecipe,
  type ImageProcessingRecipe,
  type ImageSourceSelection,
} from "./image-preprocessing";

const DATABASE_NAME = "lamdan-visual-sources";
const DATABASE_VERSION = 2;
const IMAGE_STORE = "images";
const OCR_STORE = "ocrDrafts";
const PROCESSING_STORE = "imageProcessing";
const PROCESSED_IMAGE_STORE = "processedImages";

export const MAX_VISUAL_SOURCE_BYTES = 20 * 1024 * 1024;
export const SUPPORTED_VISUAL_SOURCE_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;

export interface StoredVisualSource {
  materialId: string;
  fileName: string;
  mimeType: string;
  size: number;
  blob: Blob;
  createdAt: number;
  updatedAt: number;
}

export interface StoredOCRDraft {
  materialId: string;
  draft: OCRDraft;
  updatedAt: number;
}

/** Small, JSON-serializable state. The source blob and derived blob live elsewhere. */
export interface StoredImageProcessingState {
  materialId: string;
  recipe: ImageProcessingRecipe;
  selectedSource: ImageSourceSelection;
  sourceUpdatedAt: number;
  updatedAt: number;
}

/** Exactly one derived image cache per material; the original stays in IMAGE_STORE. */
export interface StoredProcessedVisualSource {
  materialId: string;
  fileName: string;
  mimeType: string;
  size: number;
  blob: Blob;
  width: number;
  height: number;
  recipeKey: string;
  sourceUpdatedAt: number;
  createdAt: number;
  updatedAt: number;
}

export interface OCRImageSource {
  kind: ImageSourceSelection;
  source: StoredVisualSource | StoredProcessedVisualSource;
}

export interface VisualSourceStorageStats {
  imageCount: number;
  processedImageCount: number;
  ocrDraftCount: number;
  /** Original-source bytes only, retained for truthful JSON-backup UI copy. */
  totalImageBytes: number;
  processedImageBytes: number;
  totalVisualBytes: number;
}

export function isSupportedVisualSource(file: Pick<File, "type" | "size" | "name">): boolean {
  return (
    SUPPORTED_VISUAL_SOURCE_MIMES.includes(
      file.type as (typeof SUPPORTED_VISUAL_SOURCE_MIMES)[number],
    ) &&
    file.size > 0 &&
    file.size <= MAX_VISUAL_SOURCE_BYTES
  );
}

export async function putMaterialVisualSource(materialId: string, file: File): Promise<void> {
  if (!isSupportedVisualSource(file)) {
    throw new Error(
      file.size > MAX_VISUAL_SOURCE_BYTES
        ? "Image is larger than the 20 MB local limit."
        : "Only JPEG, PNG and WebP images are supported for OCR.",
    );
  }

  const now = Date.now();
  const existing = await getMaterialVisualSource(materialId);
  const record: StoredVisualSource = {
    materialId,
    fileName: file.name,
    mimeType: file.type,
    size: file.size,
    blob: file,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await writeRecord(IMAGE_STORE, record);
  // A replacement upload must never reuse a recipe or derived raster from the
  // previous source. The original has already been saved when this cleanup runs.
  await deleteMaterialImageProcessing(materialId);
}

export async function getMaterialVisualSource(
  materialId: string,
): Promise<StoredVisualSource | undefined> {
  return readRecord<StoredVisualSource>(IMAGE_STORE, materialId);
}

export async function hasMaterialVisualSource(materialId: string): Promise<boolean> {
  return Boolean(await getMaterialVisualSource(materialId));
}

export async function getMaterialImageProcessingState(
  materialId: string,
): Promise<StoredImageProcessingState | undefined> {
  return readRecord<StoredImageProcessingState>(PROCESSING_STORE, materialId);
}

export async function putMaterialImageProcessingState(
  materialId: string,
  recipe: Partial<ImageProcessingRecipe>,
  selectedSource: ImageSourceSelection,
  sourceUpdatedAt: number,
): Promise<StoredImageProcessingState> {
  const existing = await getMaterialImageProcessingState(materialId);
  const record: StoredImageProcessingState = {
    materialId,
    recipe: normalizeImageProcessingRecipe(recipe),
    selectedSource,
    sourceUpdatedAt,
    updatedAt: Date.now(),
  };
  if (existing?.sourceUpdatedAt !== sourceUpdatedAt) {
    await deleteRecord(await openDatabase(), PROCESSED_IMAGE_STORE, materialId);
  }
  await writeRecord(PROCESSING_STORE, record);
  return record;
}

export async function getMaterialProcessedVisualSource(
  materialId: string,
): Promise<StoredProcessedVisualSource | undefined> {
  return readRecord<StoredProcessedVisualSource>(PROCESSED_IMAGE_STORE, materialId);
}

export async function putMaterialProcessedVisualSource(
  materialId: string,
  input: Omit<
    StoredProcessedVisualSource,
    "materialId" | "size" | "createdAt" | "updatedAt" | "recipeKey"
  > & { recipe: Partial<ImageProcessingRecipe> },
): Promise<StoredProcessedVisualSource> {
  const existing = await getMaterialProcessedVisualSource(materialId);
  const recipe = normalizeImageProcessingRecipe(input.recipe);
  const now = Date.now();
  const record: StoredProcessedVisualSource = {
    materialId,
    fileName: input.fileName,
    mimeType: input.mimeType,
    size: input.blob.size,
    blob: input.blob,
    width: input.width,
    height: input.height,
    recipeKey: imageProcessingRecipeKey(recipe),
    sourceUpdatedAt: input.sourceUpdatedAt,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await writeRecord(PROCESSED_IMAGE_STORE, record);
  return record;
}

/**
 * Returns the exact blob that OCR should use. A stale, missing or mismatched
 * derived cache safely falls back to the immutable original instead of failing.
 */
export async function getMaterialOCRImageSource(
  materialId: string,
): Promise<OCRImageSource | undefined> {
  const [original, processing] = await Promise.all([
    getMaterialVisualSource(materialId),
    getMaterialImageProcessingState(materialId),
  ]);
  if (!original) return undefined;
  if (processing?.selectedSource !== "processed") {
    return { kind: "original", source: original };
  }

  const processed = await getMaterialProcessedVisualSource(materialId);
  if (
    processed &&
    processed.sourceUpdatedAt === original.updatedAt &&
    processed.sourceUpdatedAt === processing.sourceUpdatedAt &&
    processed.recipeKey === imageProcessingRecipeKey(processing.recipe)
  ) {
    return { kind: "processed", source: processed };
  }
  return { kind: "original", source: original };
}

export async function deleteMaterialImageProcessing(materialId: string): Promise<void> {
  const db = await openDatabase();
  await Promise.all([
    deleteRecord(db, PROCESSING_STORE, materialId),
    deleteRecord(db, PROCESSED_IMAGE_STORE, materialId),
  ]);
}

export async function deleteMaterialVisualData(materialId: string): Promise<void> {
  const db = await openDatabase();
  await Promise.all([
    deleteRecord(db, IMAGE_STORE, materialId),
    deleteRecord(db, OCR_STORE, materialId),
    deleteRecord(db, PROCESSING_STORE, materialId),
    deleteRecord(db, PROCESSED_IMAGE_STORE, materialId),
  ]);
}

export async function putMaterialOCRDraft(materialId: string, draft: OCRDraft): Promise<void> {
  const record: StoredOCRDraft = {
    materialId,
    draft,
    updatedAt: Date.now(),
  };
  await writeRecord(OCR_STORE, record);
}

export async function getMaterialOCRDraft(materialId: string): Promise<OCRDraft | undefined> {
  const record = await readRecord<StoredOCRDraft>(OCR_STORE, materialId);
  return record?.draft;
}

export async function deleteMaterialOCRDraft(materialId: string): Promise<void> {
  const db = await openDatabase();
  await deleteRecord(db, OCR_STORE, materialId);
}

export async function clearAllVisualSourceData(): Promise<void> {
  const db = await openDatabase();
  await Promise.all([
    clearStore(db, IMAGE_STORE),
    clearStore(db, OCR_STORE),
    clearStore(db, PROCESSING_STORE),
    clearStore(db, PROCESSED_IMAGE_STORE),
  ]);
}

export async function pruneVisualSourceData(validMaterialIds: Iterable<string>): Promise<number> {
  const validIds = new Set(validMaterialIds);
  const db = await openDatabase();
  const [imageKeys, draftKeys, processingKeys, processedImageKeys] = await Promise.all([
    readAllKeys(db, IMAGE_STORE),
    readAllKeys(db, OCR_STORE),
    readAllKeys(db, PROCESSING_STORE),
    readAllKeys(db, PROCESSED_IMAGE_STORE),
  ]);
  const orphanIds = new Set(
    [...imageKeys, ...draftKeys, ...processingKeys, ...processedImageKeys]
      .map(String)
      .filter((materialId) => !validIds.has(materialId)),
  );
  await Promise.all([...orphanIds].map((materialId) => deleteMaterialVisualData(materialId)));
  return orphanIds.size;
}

export async function getVisualSourceStorageStats(): Promise<VisualSourceStorageStats> {
  const db = await openDatabase();
  const [images, drafts, processedImages] = await Promise.all([
    readAllRecords<StoredVisualSource>(db, IMAGE_STORE),
    readAllRecords<StoredOCRDraft>(db, OCR_STORE),
    readAllRecords<StoredProcessedVisualSource>(db, PROCESSED_IMAGE_STORE),
  ]);
  const totalImageBytes = images.reduce((sum, image) => sum + image.size, 0);
  const processedImageBytes = processedImages.reduce((sum, image) => sum + image.size, 0);
  return {
    imageCount: images.length,
    processedImageCount: processedImages.length,
    ocrDraftCount: drafts.length,
    totalImageBytes,
    processedImageBytes,
    totalVisualBytes: totalImageBytes + processedImageBytes,
  };
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is not available in this browser."));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IMAGE_STORE)) {
        db.createObjectStore(IMAGE_STORE, { keyPath: "materialId" });
      }
      if (!db.objectStoreNames.contains(OCR_STORE)) {
        db.createObjectStore(OCR_STORE, { keyPath: "materialId" });
      }
      if (!db.objectStoreNames.contains(PROCESSING_STORE)) {
        db.createObjectStore(PROCESSING_STORE, { keyPath: "materialId" });
      }
      if (!db.objectStoreNames.contains(PROCESSED_IMAGE_STORE)) {
        db.createObjectStore(PROCESSED_IMAGE_STORE, { keyPath: "materialId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not open visual-source storage."));
    request.onblocked = () =>
      reject(new Error("Visual-source storage upgrade is blocked by another tab."));
  });
}

async function writeRecord(storeName: string, value: unknown): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(value);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Could not save local visual data."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Visual-data save was aborted."));
  });
}

async function readRecord<T>(storeName: string, key: string): Promise<T | undefined> {
  const db = await openDatabase();
  return new Promise<T | undefined>((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error ?? new Error("Could not read local visual data."));
  });
}

function readAllRecords<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not inspect local visual data."));
  });
}

function readAllKeys(db: IDBDatabase, storeName: string): Promise<IDBValidKey[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).getAllKeys();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not inspect visual-data keys."));
  });
}

function deleteRecord(db: IDBDatabase, storeName: string, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).delete(key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Could not delete local visual data."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Visual-data deletion was aborted."));
  });
}

function clearStore(db: IDBDatabase, storeName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Could not clear local visual data."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Visual-data clearing was aborted."));
  });
}
