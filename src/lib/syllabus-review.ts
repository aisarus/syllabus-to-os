import * as XLSX from "xlsx";
import {
  ingestFile,
  ingestPastedText,
  type IngestChunk,
  type IngestResult,
} from "./document-ingestion";
import {
  PARSER_VERSION,
  normalizedTitle,
  parseWorkbookToSyllabusDraft,
  readSheetRows,
  type ParsedCourseDraft,
  type ParsedSyllabusDraft,
} from "./syllabus-parser";
import type { AppData, Course } from "./store";

export type SyllabusSourceType = "xlsx" | "pdf" | "docx" | "text" | "csv";
export type SyllabusFieldKey =
  "title" | "number" | "instructor" | "credits" | "semester" | "description";

export interface ReviewCourseDraft extends ParsedCourseDraft {
  readings: string[];
  assignments: string[];
  exams: string[];
  grading: string[];
  fieldConfidence: Partial<Record<SyllabusFieldKey, number>>;
}

export interface ReviewSyllabusDraft extends Omit<ParsedSyllabusDraft, "courses"> {
  courses: ReviewCourseDraft[];
  sourceType: SyllabusSourceType;
  sourceText: string;
}

export interface SyllabusSourceDocument {
  fileName: string;
  sourceType: SyllabusSourceType;
  rawText: string;
  chunks: IngestChunk[];
  extraction: IngestResult;
  sheets: { name: string; rows: string[][] }[];
}

export interface DuplicateCourseMatch {
  course: Course;
  reason: "number" | "title";
}

const LABELS = {
  title: ["שם הקורס", "שם קורס", "course title", "course name", "название курса"],
  number: ["מספר קורס", "קוד קורס", "course code", "course number", "код курса", "номер курса"],
  instructor: ["שם המרצה", "מרצה", "instructor", "lecturer", "преподаватель", "лектор"],
  credits: ["נקודות זכות", "נק״ז", 'נק"ז', "נ״ז", 'נ"ז', "credits", "кредиты"],
  semester: ["סמסטר", "semester", "семестр"],
  description: [
    "תיאור הקורס",
    "תיאור",
    "course description",
    "description",
    "описание курса",
    "описание",
  ],
};

const SECTION_LABELS = {
  topics: [
    "נושאי הקורס",
    "תכנית הקורס",
    "תוכנית הקורס",
    "מהלך הקורס",
    "weekly topics",
    "course schedule",
    "course topics",
    "темы курса",
    "план курса",
  ],
  readings: [
    "רשימת קריאה",
    "קריאת חובה",
    "ביבליוגרפיה",
    "bibliography",
    "readings",
    "required reading",
    "литература",
    "список литературы",
  ],
  assignments: [
    "מטלות",
    "משימות",
    "עבודות",
    "assignments",
    "course requirements",
    "задания",
    "работы",
  ],
  exams: ["בחינות", "מבחן", "exam", "exams", "экзамен", "экзамены"],
  grading: [
    "הרכב הציון",
    "שיטת הערכה",
    "הערכה",
    "grading",
    "grade composition",
    "assessment",
    "оценивание",
    "состав оценки",
  ],
};

export async function ingestSyllabusFile(file: File): Promise<{
  source: SyllabusSourceDocument;
  draft: ReviewSyllabusDraft;
}> {
  const sourceType = sourceTypeFromName(file.name);
  const extraction = await ingestFile(file);
  if (extraction.status === "error" || extraction.status === "unsupported") {
    throw new Error(extraction.message || "Could not extract syllabus text");
  }

  let parsed: ParsedSyllabusDraft;
  let sheets: { name: string; rows: string[][] }[];

  if (sourceType === "xlsx") {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    parsed = parseWorkbookToSyllabusDraft(workbook, { sourceFileName: file.name });
    sheets = workbook.SheetNames.map((name) => ({ name, rows: readSheetRows(workbook, name) }));
  } else {
    parsed = parseTextSyllabusDraft(extraction.rawText, file.name);
    sheets = textToSheets(extraction.rawText, file.name);
  }

  const source: SyllabusSourceDocument = {
    fileName: file.name,
    sourceType,
    rawText: extraction.rawText,
    chunks: extraction.chunks,
    extraction,
    sheets,
  };

  return { source, draft: toReviewDraft(parsed, source) };
}

export function ingestPastedSyllabus(text: string): {
  source: SyllabusSourceDocument;
  draft: ReviewSyllabusDraft;
} {
  const extraction = ingestPastedText(text);
  const fileName = "pasted-syllabus.txt";
  const source: SyllabusSourceDocument = {
    fileName,
    sourceType: "text",
    rawText: extraction.rawText,
    chunks: extraction.chunks,
    extraction,
    sheets: textToSheets(extraction.rawText, fileName),
  };
  return { source, draft: toReviewDraft(parseTextSyllabusDraft(text, fileName), source) };
}

export function mergeAISyllabusDraft(
  ai: ParsedSyllabusDraft,
  fallback: ReviewSyllabusDraft,
): ReviewSyllabusDraft {
  const fallbackByKey = new Map(fallback.courses.map((course) => [courseKey(course), course]));
  const courses = ai.courses.map((course) => {
    const previous = fallbackByKey.get(courseKey(course));
    return normalizeReviewCourse({
      ...previous,
      ...course,
      topics: course.topics?.length ? course.topics : (previous?.topics ?? []),
      readings: previous?.readings ?? [],
      assignments: previous?.assignments ?? [],
      exams: previous?.exams ?? [],
      grading: previous?.grading ?? [],
      fieldConfidence: {
        ...(previous?.fieldConfidence ?? {}),
        title: course.confidence,
      },
    });
  });

  return {
    ...fallback,
    ...ai,
    sourceType: fallback.sourceType,
    sourceText: fallback.sourceText,
    courses,
    warnings: Array.from(new Set([...(fallback.warnings ?? []), ...(ai.warnings ?? [])])),
    stats: {
      detectedSemesters: ai.semesters.length,
      detectedCourses: courses.length,
      warnings:
        ai.warnings.length + courses.reduce((sum, course) => sum + course.warnings.length, 0),
      lowConfidenceCourses: courses.filter((course) => course.confidence < 0.6).length,
    },
  };
}

export function findDuplicateCourse(
  data: AppData,
  incoming: ReviewCourseDraft,
): DuplicateCourseMatch | null {
  const incomingNumber = incoming.number;
  const byNumber = incomingNumber
    ? data.courses.find(
        (course) => course.number && normalizeCode(course.number) === normalizeCode(incomingNumber),
      )
    : undefined;
  if (byNumber) return { course: byNumber, reason: "number" };

  const title = normalizedTitle(incoming.title);
  if (!title) return null;
  const byTitle = data.courses.find((course) => normalizedTitle(course.title) === title);
  return byTitle ? { course: byTitle, reason: "title" } : null;
}

export function previousImportMatches(data: AppData, fileName: string): number {
  const normalized = fileName.trim().toLowerCase();
  return data.syllabusImports.filter((item) => item.fileName?.trim().toLowerCase() === normalized)
    .length;
}

export function syllabusDetailsMarkdown(course: ReviewCourseDraft): string {
  const section = (title: string, items: string[]) =>
    items.length ? `\n## ${title}\n\n${items.map((item) => `- ${item}`).join("\n")}\n` : "";

  return [
    `# ${course.title}`,
    course.number ? `\n**Course code:** ${course.number}` : "",
    course.instructor ? `\n**Instructor:** ${course.instructor}` : "",
    course.credits != null ? `\n**Credits:** ${course.credits}` : "",
    course.semester ? `\n**Semester:** ${course.semester}` : "",
    course.description ? `\n\n## Description\n\n${course.description}` : "",
    section("Weekly topics", course.topics),
    section("Readings", course.readings),
    section("Assignments", course.assignments),
    section("Exams", course.exams),
    section("Grading", course.grading),
  ]
    .filter(Boolean)
    .join("")
    .trim();
}

export function normalizeReviewCourse(
  course: Partial<ReviewCourseDraft> & Pick<ParsedCourseDraft, "id" | "title" | "source">,
): ReviewCourseDraft {
  return {
    id: course.id,
    include: course.include !== false,
    title: course.title?.trim() || "",
    originalTitle: course.originalTitle,
    number: cleanOptional(course.number),
    semesterId: course.semesterId,
    year: course.year,
    semester: cleanOptional(course.semester),
    credits: course.credits,
    type: cleanOptional(course.type),
    instructor: cleanOptional(course.instructor),
    prerequisites: cleanOptional(course.prerequisites),
    description: cleanOptional(course.description),
    notes: cleanOptional(course.notes),
    topics: cleanList(course.topics),
    readings: cleanList(course.readings),
    assignments: cleanList(course.assignments),
    exams: cleanList(course.exams),
    grading: cleanList(course.grading),
    confidence: clamp01(course.confidence ?? 0.5),
    fieldConfidence: course.fieldConfidence ?? {},
    warnings: cleanList(course.warnings),
    source: course.source,
  };
}

function toReviewDraft(
  parsed: ParsedSyllabusDraft,
  source: SyllabusSourceDocument,
): ReviewSyllabusDraft {
  const textDetails = parseTextSections(source.rawText);
  const courses = parsed.courses.map((course, index) =>
    normalizeReviewCourse({
      ...course,
      topics: course.topics?.length ? course.topics : index === 0 ? textDetails.topics : [],
      readings: index === 0 ? textDetails.readings : [],
      assignments: index === 0 ? textDetails.assignments : [],
      exams: index === 0 ? textDetails.exams : [],
      grading: index === 0 ? textDetails.grading : [],
      fieldConfidence: inferFieldConfidence(course),
    }),
  );

  return {
    ...parsed,
    sourceType: source.sourceType,
    sourceText: source.rawText,
    courses,
  };
}

function parseTextSyllabusDraft(text: string, fileName: string): ParsedSyllabusDraft {
  const lines = cleanLines(text);
  const title = findLabeledValue(lines, LABELS.title) || findFallbackTitle(lines, fileName);
  const number = findLabeledValue(lines, LABELS.number);
  const instructor = findLabeledValue(lines, LABELS.instructor);
  const creditsRaw = findLabeledValue(lines, LABELS.credits);
  const creditsMatch = creditsRaw?.match(/\d+(?:[.,]\d+)?/);
  const credits = creditsMatch ? Number(creditsMatch[0].replace(",", ".")) : undefined;
  const semester = findLabeledValue(lines, LABELS.semester);
  const description = extractDescription(lines);
  const sections = parseTextSections(text);
  const institution = lines.find((line) =>
    /(?:אוניברסיט|מכלל|university|college|институт|университет)/i.test(line),
  );
  const foundSignals = [title, number, instructor, credits, semester, description].filter(
    Boolean,
  ).length;
  const confidence = clamp01(0.35 + foundSignals * 0.08 + (sections.topics.length ? 0.15 : 0));
  const warnings: string[] = [];
  if (!number) warnings.push("course_code_not_detected");
  if (!instructor) warnings.push("instructor_not_detected");
  if (!sections.topics.length) warnings.push("weekly_topics_not_detected");

  const course: ParsedCourseDraft = {
    id: `crs_text_${Date.now().toString(36)}`,
    include: true,
    title,
    originalTitle: title,
    number,
    semester,
    credits: Number.isFinite(credits) ? credits : undefined,
    instructor,
    description,
    topics: sections.topics,
    confidence,
    warnings,
    source: {
      sheetName: "Extracted text",
      rowIndex: 0,
      originalCells: lines.slice(0, 20),
    },
  };

  return {
    id: `syl_text_${Date.now().toString(36)}`,
    sourceFileName: fileName,
    parserVersion: `${PARSER_VERSION}+text-1`,
    parserType: "deterministic",
    confidence,
    institution,
    programName: undefined,
    degree: undefined,
    warnings,
    semesters: [],
    courses: [course],
    ignoredRows: [],
    detectedSheetName: "Extracted text",
    stats: {
      detectedSemesters: 0,
      detectedCourses: 1,
      warnings: warnings.length,
      lowConfidenceCourses: confidence < 0.6 ? 1 : 0,
    },
  };
}

function parseTextSections(text: string): {
  topics: string[];
  readings: string[];
  assignments: string[];
  exams: string[];
  grading: string[];
} {
  const lines = cleanLines(text);
  const buckets = {
    topics: [] as string[],
    readings: [] as string[],
    assignments: [] as string[],
    exams: [] as string[],
    grading: [] as string[],
  };
  let active: keyof typeof buckets | null = null;

  for (const line of lines) {
    const section = detectSection(line);
    if (section) {
      active = section;
      const inline = valueAfterLabel(line);
      if (inline) buckets[section].push(inline);
      continue;
    }

    const weekly = parseWeeklyTopic(line);
    if (weekly) {
      buckets.topics.push(weekly);
      if (!active) active = "topics";
      continue;
    }

    if (!active) continue;
    if (looksLikeMetadataLabel(line)) {
      active = null;
      continue;
    }
    const cleaned = cleanListItem(line);
    if (cleaned && cleaned.length <= 600) buckets[active].push(cleaned);
  }

  return {
    topics: dedupe(buckets.topics).slice(0, 40),
    readings: dedupe(buckets.readings).slice(0, 80),
    assignments: dedupe(buckets.assignments).slice(0, 30),
    exams: dedupe(buckets.exams).slice(0, 20),
    grading: dedupe(buckets.grading).slice(0, 30),
  };
}

function inferFieldConfidence(
  course: ParsedCourseDraft,
): Partial<Record<SyllabusFieldKey, number>> {
  const base = clamp01(course.confidence);
  return {
    title: course.title ? Math.max(base, 0.65) : 0,
    number: course.number ? Math.max(base, 0.72) : 0,
    instructor: course.instructor ? Math.max(base, 0.65) : 0,
    credits: course.credits != null ? Math.max(base, 0.68) : 0,
    semester: course.semester ? Math.max(base, 0.62) : 0,
    description: course.description ? Math.max(base, 0.55) : 0,
  };
}

function sourceTypeFromName(fileName: string): SyllabusSourceType {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension === "xlsx" || extension === "xls") return "xlsx";
  if (extension === "pdf") return "pdf";
  if (extension === "docx") return "docx";
  if (extension === "csv") return "csv";
  return "text";
}

function textToSheets(text: string, fileName: string): { name: string; rows: string[][] }[] {
  const rows = cleanLines(text)
    .slice(0, 400)
    .map((line) => [line]);
  return [{ name: fileName || "Extracted text", rows }];
}

function cleanLines(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function findLabeledValue(lines: string[], labels: string[]): string | undefined {
  for (const line of lines) {
    const normalized = normalize(line);
    for (const label of labels) {
      const normalizedLabel = normalize(label);
      if (!normalized.startsWith(normalizedLabel)) continue;
      const value = valueAfterLabel(line);
      if (value && normalize(value) !== normalizedLabel) return value;
    }
  }
  return undefined;
}

function valueAfterLabel(line: string): string | undefined {
  const parts = line.split(/\s*[:：\-–—]\s*/, 2);
  return parts.length > 1 ? cleanOptional(parts[1]) : undefined;
}

function findFallbackTitle(lines: string[], fileName: string): string {
  const candidate = lines.find(
    (line) =>
      line.length >= 4 &&
      line.length <= 180 &&
      !looksLikeMetadataLabel(line) &&
      !/(?:אוניברסיט|מכלל|university|college|syllabus|סילבוס)/i.test(line),
  );
  return (
    candidate ||
    fileName
      .replace(/\.[^.]+$/, "")
      .replace(/[_-]+/g, " ")
      .trim() ||
    "Untitled course"
  );
}

function extractDescription(lines: string[]): string | undefined {
  const direct = findLabeledValue(lines, LABELS.description);
  if (direct) return direct;
  const index = lines.findIndex((line) => matchesAnyLabel(line, LABELS.description));
  if (index < 0) return undefined;
  const collected: string[] = [];
  for (const line of lines.slice(index + 1)) {
    if (detectSection(line) || looksLikeMetadataLabel(line)) break;
    collected.push(line);
    if (collected.join(" ").length > 1500) break;
  }
  return cleanOptional(collected.join(" "));
}

function detectSection(line: string): keyof typeof SECTION_LABELS | null {
  for (const [key, labels] of Object.entries(SECTION_LABELS) as [
    keyof typeof SECTION_LABELS,
    string[],
  ][]) {
    if (matchesAnyLabel(line, labels)) return key;
  }
  return null;
}

function matchesAnyLabel(line: string, labels: string[]): boolean {
  const normalized = normalize(line);
  return labels.some((label) => {
    const target = normalize(label);
    return (
      normalized === target ||
      normalized.startsWith(`${target} `) ||
      normalized.startsWith(`${target}:`)
    );
  });
}

function parseWeeklyTopic(line: string): string | undefined {
  const match = line.match(
    /^(?:שבוע|week|недел[яи])\s*([0-9]{1,2}|[א-ת]{1,3})\s*[.:)\-–—]?\s*(.+)$/i,
  );
  if (match?.[2]) return `${match[1]}. ${cleanListItem(match[2])}`;
  if (/^\d{1,2}[.)]\s+\S/.test(line)) return cleanListItem(line);
  return undefined;
}

function looksLikeMetadataLabel(line: string): boolean {
  return Object.values(LABELS).some((labels) => matchesAnyLabel(line, labels));
}

function cleanListItem(value: string): string {
  return value
    .replace(/^[•●▪◦*-]+\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanList(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return dedupe(values.map((value) => cleanListItem(String(value))).filter(Boolean));
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = normalize(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/["׳״'`]/g, "")
    .replace(/[.,;()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCode(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9א-ת]/gi, "");
}

function cleanOptional(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim();
  return cleaned || undefined;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function courseKey(course: Pick<ParsedCourseDraft, "number" | "title">): string {
  return course.number ? `n:${normalizeCode(course.number)}` : `t:${normalizedTitle(course.title)}`;
}
