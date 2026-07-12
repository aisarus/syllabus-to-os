import { ingestFile, ingestPastedText, type IngestResult } from "./document-ingestion";
import {
  store,
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

export async function intakeFile(
  file: File,
  options: MaterialIntakeOptions = {},
): Promise<MaterialIntakeResult> {
  const extraction = await ingestFile(file);
  return persistMaterial(
    extraction,
    "uploaded_file",
    {
      ...options,
      title: normalizeMaterialTitle(options.title, file.name),
      type: options.type ?? inferMaterialType(file.name),
    },
    {
      fileName: file.name,
      mimeType: file.type || undefined,
      fileSize: file.size,
    },
  );
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
  const material = store.createMaterial({
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
  });

  if (extraction.chunks.length > 0) {
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
