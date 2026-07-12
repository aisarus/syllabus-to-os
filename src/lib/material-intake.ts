import { ingestFile, ingestPastedText, type IngestResult } from "./document-ingestion";
import {
  store,
  updateData,
  type Material,
  type MaterialProcessingStatus,
  type MaterialSourceMode,
  type MaterialType,
} from "./store";

export type MaterialIntakeOutcome = "success" | "partial" | "unsupported" | "error";

export interface MaterialIntakeOptions {
  title?: string;
  type?: MaterialType;
  courseId?: string;
  topicId?: string;
  tags?: string[];
  existingMaterialId?: string;
}

export interface PreparedFileIntake {
  fileName: string;
  mimeType?: string;
  fileSize: number;
  extraction: IngestResult;
  inferredType: MaterialType;
}

export interface MaterialIntakeResult {
  ok: boolean;
  outcome: MaterialIntakeOutcome;
  material: Material;
  extraction: IngestResult;
  message?: string;
}

export function inferMaterialType(value: string): MaterialType {
  const normalized = value.toLowerCase();
  if (/syllabus|силлабус|силабус|סילבוס/.test(normalized)) return "syllabus";
  if (/exam|экзамен|тест|מבחן/.test(normalized)) return "exam";
  if (/assignment|essay|homework|задани|эссе|מטלה/.test(normalized)) return "assignment";
  if (/presentation|slides|презентац|מצגת/.test(normalized)) return "presentation";
  if (/lecture|lesson|лекци|заняти|הרצאה|שיעור/.test(normalized)) return "lecture";
  if (/article|paper|стать|מאמר/.test(normalized)) return "article";
  return "other";
}

export function normalizeMaterialTitle(title: string | undefined, fallback: string): string {
  const normalized = title?.trim();
  return normalized || fallback.trim() || "Material";
}

export function normalizeComparableText(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u0591-\u05c7]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[\p{P}\p{S}]+/gu, "")
    .trim();
}

export function normalizeComparableFileName(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/(?:\s*[-_]?(?:copy|копия|עותק)|\s*\(\d+\))$/u, "")
    .replace(/[\s_-]+/g, " ")
    .trim();
}

export function intakeOutcome(status: MaterialProcessingStatus): MaterialIntakeOutcome {
  switch (status) {
    case "ready":
      return "success";
    case "partial":
    case "no_text":
      return "partial";
    case "unsupported":
      return "unsupported";
    case "error":
      return "error";
  }
}

export async function prepareFileIntake(file: File): Promise<PreparedFileIntake> {
  return {
    fileName: file.name,
    mimeType: file.type || undefined,
    fileSize: file.size,
    extraction: await ingestFile(file),
    inferredType: inferMaterialType(file.name),
  };
}

export function persistPreparedFile(
  prepared: PreparedFileIntake,
  options: MaterialIntakeOptions = {},
): MaterialIntakeResult {
  return persistMaterial(
    prepared.extraction,
    "uploaded_file",
    {
      ...options,
      title: normalizeMaterialTitle(options.title, prepared.fileName),
      type: options.type ?? prepared.inferredType,
    },
    {
      fileName: prepared.fileName,
      mimeType: prepared.mimeType,
      fileSize: prepared.fileSize,
    },
  );
}

export async function intakeFile(
  file: File,
  options: MaterialIntakeOptions = {},
): Promise<MaterialIntakeResult> {
  return persistPreparedFile(await prepareFileIntake(file), options);
}

export function intakeText(
  text: string,
  options: MaterialIntakeOptions = {},
): MaterialIntakeResult {
  const extraction = ingestPastedText(text);
  const fallbackTitle = inferMaterialType(text.slice(0, 160)) === "syllabus" ? "Syllabus" : "Pasted text";
  return persistMaterial(
    extraction,
    "pasted_text",
    {
      ...options,
      title: normalizeMaterialTitle(options.title, fallbackTitle),
      type: options.type ?? inferMaterialType(`${options.title ?? ""} ${text.slice(0, 400)}`),
    },
  );
}

function persistMaterial(
  extraction: IngestResult,
  sourceMode: MaterialSourceMode,
  options: Required<Pick<MaterialIntakeOptions, "title" | "type">> & MaterialIntakeOptions,
  fileMetadata: Pick<Material, "fileName" | "mimeType" | "fileSize"> = {},
): MaterialIntakeResult {
  const patch: Omit<Material, "id" | "createdAt" | "updatedAt"> = {
    title: options.title,
    type: options.type,
    sourceMode,
    ...fileMetadata,
    courseId: options.courseId,
    topicId: options.topicId,
    tags: normalizeTags(options.tags),
    rawText: extraction.rawText,
    processingStatus: extraction.status,
    processingMessage: extraction.message,
    extractionMethod: extraction.extractionMethod,
    pageCount: extraction.pageCount,
    wordCount: extraction.wordCount,
    charCount: extraction.charCount,
    sourceLanguage: extraction.sourceLanguage,
  };

  let material: Material | undefined;
  if (options.existingMaterialId) {
    updateData((data) => {
      const existing = data.materials.find((item) => item.id === options.existingMaterialId);
      if (!existing) return data;
      material = {
        ...existing,
        ...patch,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: Date.now(),
      };
      return {
        ...data,
        materials: data.materials.map((item) => (item.id === existing.id ? material! : item)),
      };
    });
  }

  if (!material) {
    material = store.createMaterial(patch);
  }

  if (options.existingMaterialId || extraction.chunks.length > 0) {
    store.replaceMaterialChunksForMaterial(material.id, extraction.chunks);
  }

  const outcome = intakeOutcome(extraction.status);
  return {
    ok: outcome === "success" || outcome === "partial",
    outcome,
    material,
    extraction,
    message: extraction.message,
  };
}

function normalizeTags(tags: string[] | undefined): string[] {
  if (!tags) return [];
  return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));
}
