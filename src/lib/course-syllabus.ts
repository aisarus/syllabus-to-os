import {
  uid,
  updateData,
  type AppData,
  type Assignment,
  type Course,
  type Topic,
} from "./store";

export const COURSE_SYLLABUS_DRAFT_VERSION = "course-syllabus-v1";

export interface SyllabusTopicDraft {
  id: string;
  include: boolean;
  week?: string;
  title: string;
  description?: string;
  confidence: number;
  warnings: string[];
}

export interface SyllabusReadingDraft {
  id: string;
  include: boolean;
  citation: string;
  confidence: number;
}

export type SyllabusAssessmentType = "assignment" | "exam" | "presentation" | "project" | "other";

export interface SyllabusAssessmentDraft {
  id: string;
  include: boolean;
  type: SyllabusAssessmentType;
  title: string;
  dueDate?: string;
  weight?: string;
  description?: string;
  confidence: number;
  warnings: string[];
}

export interface CourseSyllabusFieldConfidence {
  title: number;
  number: number;
  instructor: number;
  credits: number;
  semester: number;
  description: number;
  grading: number;
}

export interface CourseSyllabusDraft {
  id: string;
  version: string;
  parserType: "deterministic" | "ai_assisted";
  sourceFileName: string;
  sourceLanguage?: string;
  title: string;
  number?: string;
  instructor?: string;
  credits?: number;
  semester?: string;
  description?: string;
  grading?: string;
  topics: SyllabusTopicDraft[];
  readings: SyllabusReadingDraft[];
  assessments: SyllabusAssessmentDraft[];
  confidence: CourseSyllabusFieldConfidence;
  warnings: string[];
}

export interface CourseSyllabusDuplicateCandidate {
  course: Course;
  score: number;
  reasons: string[];
}

export interface ApplyCourseSyllabusOptions {
  mode: "create" | "update";
  existingCourseId?: string;
}

export interface ApplyCourseSyllabusResult {
  courseId: string;
  created: boolean;
  topicIds: string[];
  assignmentIds: string[];
}

const HEADING_WORDS = [
  "סילבוס",
  "syllabus",
  "תיאור הקורס",
  "course description",
  "שם הקורס",
  "course name",
  "course title",
];

export function createDeterministicCourseSyllabusDraft(
  rawText: string,
  sourceFileName: string,
  sourceLanguage?: string,
): CourseSyllabusDraft {
  const text = normalizeSourceText(rawText);
  const lines = text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const warnings: string[] = [];

  const labeledTitle = findLabeledValue(lines, [
    /^(?:שם\s*הקורס|כותרת\s*הקורס)\s*[:\-]\s*(.+)$/i,
    /^(?:course\s*(?:name|title))\s*[:\-]\s*(.+)$/i,
    /^(?:название\s*курса)\s*[:\-]\s*(.+)$/i,
  ]);
  const fallbackTitle = lines.find(
    (line) =>
      line.length >= 4 &&
      line.length <= 160 &&
      !HEADING_WORDS.some((word) => normalizeComparable(line) === normalizeComparable(word)) &&
      !looksLikeMetadataLine(line),
  );
  const title = labeledTitle || fallbackTitle || "";
  if (!title) warnings.push("course_title_not_detected");

  const number = findLabeledValue(lines, [
    /^(?:מספר|קוד)\s*קורס\s*[:\-]\s*([\w.\-/]+)$/i,
    /^(?:course\s*(?:number|code))\s*[:\-]\s*([\w.\-/]+)$/i,
    /^(?:код|номер)\s*курса\s*[:\-]\s*([\w.\-/]+)$/i,
  ]);
  const instructor = findLabeledValue(lines, [
    /^(?:מרצה|שם\s*המרצה)\s*[:\-]\s*(.+)$/i,
    /^(?:instructor|lecturer|professor)\s*[:\-]\s*(.+)$/i,
    /^(?:преподаватель|лектор)\s*[:\-]\s*(.+)$/i,
  ]);
  const creditsRaw = findLabeledValue(lines, [
    /^(?:נ["״]?ז|נקודות\s*זכות)\s*[:\-]\s*([\d.,]+)$/i,
    /^(?:credits?|credit\s*points?)\s*[:\-]\s*([\d.,]+)$/i,
    /^(?:кредиты|зач[её]тные\s*единицы)\s*[:\-]\s*([\d.,]+)$/i,
  ]);
  const credits = creditsRaw ? parseSafeNumber(creditsRaw) : undefined;
  const semester = findLabeledValue(lines, [
    /^(?:סמסטר|שנת\s*לימודים)\s*[:\-]\s*(.+)$/i,
    /^(?:semester|academic\s*year)\s*[:\-]\s*(.+)$/i,
    /^(?:семестр|учебный\s*год)\s*[:\-]\s*(.+)$/i,
  ]);

  const topics = detectTopics(lines);
  const readings = detectReadings(lines);
  const assessments = detectAssessments(lines);
  const description = extractSection(text, [
    "תיאור הקורס",
    "מטרות הקורס",
    "course description",
    "course objectives",
    "описание курса",
    "цели курса",
  ]);
  const grading = extractSection(text, [
    "הרכב הציון",
    "דרישות הקורס",
    "grading",
    "assessment",
    "course requirements",
    "оценивание",
    "требования курса",
  ]);

  if (topics.length === 0) warnings.push("weekly_topics_not_detected");
  if (assessments.length === 0) warnings.push("assessments_not_detected");

  return {
    id: uid("csyl"),
    version: COURSE_SYLLABUS_DRAFT_VERSION,
    parserType: "deterministic",
    sourceFileName,
    sourceLanguage,
    title,
    number,
    instructor,
    credits,
    semester,
    description,
    grading,
    topics,
    readings,
    assessments,
    confidence: {
      title: labeledTitle ? 0.95 : title ? 0.55 : 0,
      number: number ? 0.9 : 0,
      instructor: instructor ? 0.85 : 0,
      credits: credits != null ? 0.9 : 0,
      semester: semester ? 0.8 : 0,
      description: description ? 0.7 : 0,
      grading: grading ? 0.65 : 0,
    },
    warnings,
  };
}

export function normalizeCourseSyllabusDraft(
  input: unknown,
  fallback: CourseSyllabusDraft,
): CourseSyllabusDraft {
  if (!input || typeof input !== "object") return fallback;
  const value = input as Record<string, unknown>;
  const text = (item: unknown): string | undefined =>
    typeof item === "string" && item.trim() ? item.trim() : undefined;
  const confidence = (item: unknown, defaultValue = 0.5): number =>
    typeof item === "number" && Number.isFinite(item)
      ? Math.max(0, Math.min(1, item))
      : defaultValue;
  const fieldConfidence = (value.confidence ?? {}) as Record<string, unknown>;
  const topics = arrayOfObjects(value.topics)
    .map((topic, index): SyllabusTopicDraft => ({
      id: text(topic.id) ?? `topic_ai_${index}`,
      include: topic.include !== false,
      week: text(topic.week),
      title: text(topic.title) ?? "",
      description: text(topic.description),
      confidence: confidence(topic.confidence),
      warnings: arrayOfStrings(topic.warnings),
    }))
    .filter((topic) => topic.title);
  const readings = arrayOfObjects(value.readings)
    .map((reading, index): SyllabusReadingDraft => ({
      id: text(reading.id) ?? `reading_ai_${index}`,
      include: reading.include !== false,
      citation: text(reading.citation) ?? "",
      confidence: confidence(reading.confidence),
    }))
    .filter((reading) => reading.citation);
  const assessments = arrayOfObjects(value.assessments)
    .map((assessment, index): SyllabusAssessmentDraft => ({
      id: text(assessment.id) ?? `assessment_ai_${index}`,
      include: assessment.include !== false,
      type: normalizeAssessmentType(assessment.type),
      title: text(assessment.title) ?? "",
      dueDate: normalizeDate(text(assessment.dueDate)),
      weight: text(assessment.weight),
      description: text(assessment.description),
      confidence: confidence(assessment.confidence),
      warnings: arrayOfStrings(assessment.warnings),
    }))
    .filter((assessment) => assessment.title);

  return {
    id: text(value.id) ?? fallback.id,
    version: text(value.version) ?? COURSE_SYLLABUS_DRAFT_VERSION,
    parserType: value.parserType === "ai_assisted" ? "ai_assisted" : fallback.parserType,
    sourceFileName: text(value.sourceFileName) ?? fallback.sourceFileName,
    sourceLanguage: text(value.sourceLanguage) ?? fallback.sourceLanguage,
    title: text(value.title) ?? fallback.title,
    number: text(value.number),
    instructor: text(value.instructor),
    credits:
      typeof value.credits === "number" && Number.isFinite(value.credits)
        ? value.credits
        : undefined,
    semester: text(value.semester),
    description: text(value.description),
    grading: text(value.grading),
    topics,
    readings,
    assessments,
    confidence: {
      title: confidence(fieldConfidence.title, fallback.confidence.title),
      number: confidence(fieldConfidence.number, fallback.confidence.number),
      instructor: confidence(fieldConfidence.instructor, fallback.confidence.instructor),
      credits: confidence(fieldConfidence.credits, fallback.confidence.credits),
      semester: confidence(fieldConfidence.semester, fallback.confidence.semester),
      description: confidence(fieldConfidence.description, fallback.confidence.description),
      grading: confidence(fieldConfidence.grading, fallback.confidence.grading),
    },
    warnings: Array.from(new Set([...fallback.warnings, ...arrayOfStrings(value.warnings)])),
  };
}

export function findCourseSyllabusDuplicates(
  data: AppData,
  draft: CourseSyllabusDraft,
): CourseSyllabusDuplicateCandidate[] {
  const incomingTitle = normalizeComparable(draft.title);
  const incomingNumber = normalizeCourseNumber(draft.number);

  return data.courses
    .map((course) => {
      const reasons: string[] = [];
      let score = 0;
      const existingNumber = normalizeCourseNumber(course.number);
      if (incomingNumber && existingNumber && incomingNumber === existingNumber) {
        score += 0.75;
        reasons.push("same_course_number");
      }
      const existingTitle = normalizeComparable(course.title);
      if (incomingTitle && existingTitle === incomingTitle) {
        score += 0.65;
        reasons.push("same_normalized_title");
      } else if (
        incomingTitle.length >= 8 &&
        existingTitle.length >= 8 &&
        (incomingTitle.includes(existingTitle) || existingTitle.includes(incomingTitle))
      ) {
        score += 0.35;
        reasons.push("similar_title");
      }
      return { course, score: Math.min(1, score), reasons };
    })
    .filter((candidate) => candidate.score >= 0.35)
    .sort((a, b) => b.score - a.score);
}

export function findExistingSyllabusMaterial(
  data: AppData,
  rawText: string,
  fileName?: string,
): { id: string; title: string } | undefined {
  const normalizedText = normalizeComparable(rawText).slice(0, 12_000);
  const normalizedName = normalizeComparable(fileName ?? "").replace(/\.[^.]+$/, "");
  return data.materials.find((material) => {
    if (material.type !== "syllabus") return false;
    const sameText =
      normalizedText.length >= 200 &&
      normalizeComparable(material.rawText).slice(0, 12_000) === normalizedText;
    const sameName =
      normalizedName.length >= 3 &&
      normalizeComparable(material.fileName ?? material.title).replace(/\.[^.]+$/, "") ===
        normalizedName;
    return sameText || sameName;
  });
}

export function applyCourseSyllabusDraft(
  draft: CourseSyllabusDraft,
  options: ApplyCourseSyllabusOptions,
): ApplyCourseSyllabusResult {
  let result: ApplyCourseSyllabusResult | undefined;

  updateData((data) => {
    const existing = options.existingCourseId
      ? data.courses.find((course) => course.id === options.existingCourseId)
      : undefined;
    const created = options.mode === "create" || !existing;
    const courseId = created ? uid("crs") : existing.id;
    const courseDescription = composeCourseDescription(draft);
    const course: Course = created
      ? {
          id: courseId,
          title: draft.title.trim(),
          originalTitle: draft.title.trim(),
          number: draft.number?.trim() || undefined,
          semester: draft.semester?.trim() || undefined,
          credits: draft.credits,
          instructor: draft.instructor?.trim() || undefined,
          description: courseDescription || undefined,
          status: "not_started",
          order: data.courses.length,
          createdAt: Date.now(),
        }
      : {
          ...existing,
          title: draft.title.trim(),
          originalTitle: existing.originalTitle ?? draft.title.trim(),
          number: draft.number?.trim() || undefined,
          semester: draft.semester?.trim() || undefined,
          credits: draft.credits,
          instructor: draft.instructor?.trim() || undefined,
          description: courseDescription || existing.description,
        };

    const currentTopics = data.topics.filter((topic) => topic.courseId === courseId);
    const topicIds: string[] = [];
    const topicUpdates = new Map<string, Topic>();
    const newTopics: Topic[] = [];
    draft.topics
      .filter((topic) => topic.include && topic.title.trim())
      .forEach((topic, order) => {
        const match = currentTopics.find(
          (existingTopic) =>
            normalizeComparable(existingTopic.title) === normalizeComparable(topic.title),
        );
        if (match) {
          topicIds.push(match.id);
          topicUpdates.set(match.id, {
            ...match,
            title: topic.title.trim(),
            description: topicDescription(topic) || match.description,
            order,
          });
        } else {
          const createdTopic: Topic = {
            id: uid("top"),
            courseId,
            title: topic.title.trim(),
            description: topicDescription(topic) || undefined,
            status: "not_started",
            order,
            createdAt: Date.now(),
          };
          topicIds.push(createdTopic.id);
          newTopics.push(createdTopic);
        }
      });

    const currentAssignments = data.assignments.filter(
      (assignment) => assignment.courseId === courseId,
    );
    const assignmentIds: string[] = [];
    const assignmentUpdates = new Map<string, Assignment>();
    const newAssignments: Assignment[] = [];
    draft.assessments
      .filter((assessment) => assessment.include && assessment.title.trim())
      .forEach((assessment) => {
        const match = currentAssignments.find(
          (existingAssignment) =>
            normalizeComparable(existingAssignment.title) ===
            normalizeComparable(assessment.title),
        );
        const notes = assessmentNotes(assessment);
        if (match) {
          assignmentIds.push(match.id);
          assignmentUpdates.set(match.id, {
            ...match,
            title: assessment.title.trim(),
            dueDate: assessment.dueDate ?? match.dueDate,
            notes: notes || match.notes,
          });
        } else {
          const createdAssignment: Assignment = {
            id: uid("ass"),
            title: assessment.title.trim(),
            courseId,
            dueDate: assessment.dueDate,
            status: "not_started",
            priority: assessment.type === "exam" ? "high" : "medium",
            notes: notes || undefined,
            createdAt: Date.now(),
          };
          assignmentIds.push(createdAssignment.id);
          newAssignments.push(createdAssignment);
        }
      });

    result = { courseId, created, topicIds, assignmentIds };
    return {
      ...data,
      courses: created
        ? [...data.courses, course]
        : data.courses.map((item) => (item.id === courseId ? course : item)),
      topics: [
        ...data.topics.map((item) => topicUpdates.get(item.id) ?? item),
        ...newTopics,
      ],
      assignments: [
        ...data.assignments.map((item) => assignmentUpdates.get(item.id) ?? item),
        ...newAssignments,
      ],
    };
  });

  if (!result) throw new Error("Could not apply reviewed syllabus draft");
  return result;
}

export function normalizeComparable(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u0591-\u05c7]/g, "")
    .replace(/["׳״'`]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSourceText(value: string): string {
  return value.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
}

function normalizeCourseNumber(value: string | undefined): string | undefined {
  const normalized = value?.replace(/\s+/g, "").replace(/\./g, "-").trim();
  return normalized || undefined;
}

function findLabeledValue(lines: string[], patterns: RegExp[]): string | undefined {
  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match?.[1]?.trim()) return match[1].trim();
    }
  }
  return undefined;
}

function looksLikeMetadataLine(line: string): boolean {
  return /^(?:מספר|קוד|מרצה|נ["״]?ז|סמסטר|course\s*(?:code|number)|instructor|credits?|semester|код\s*курса|преподаватель|кредиты|семестр)\s*[:\-]/i.test(
    line,
  );
}

function detectTopics(lines: string[]): SyllabusTopicDraft[] {
  const output: SyllabusTopicDraft[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const match = line.match(
      /^(?:(?:שבוע|week|недел[яи])\s*([\dא-ת]+)\s*[:.\-]?\s*|([0-9]{1,2})[.)]\s+)(.+)$/i,
    );
    if (!match) continue;
    const title = match[3]?.trim();
    if (!title || title.length < 3) continue;
    const key = normalizeComparable(title);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push({
      id: uid("stp"),
      include: true,
      week: match[1] || match[2],
      title,
      confidence: 0.65,
      warnings: [],
    });
  }
  return output;
}

function detectReadings(lines: string[]): SyllabusReadingDraft[] {
  const output: SyllabusReadingDraft[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    if (
      !/(?:doi:|https?:\/\/|\b(?:pp?\.|vol\.|journal|press)\b|מאמר|ספר|קריאת\s*חובה)/i.test(
        line,
      )
    ) {
      continue;
    }
    if (line.length < 8 || line.length > 600) continue;
    const key = normalizeComparable(line);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push({ id: uid("srd"), include: true, citation: line, confidence: 0.55 });
  }
  return output.slice(0, 80);
}

function detectAssessments(lines: string[]): SyllabusAssessmentDraft[] {
  const output: SyllabusAssessmentDraft[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const type = assessmentTypeFromText(line);
    if (!type) continue;
    if (line.length < 3 || line.length > 400) continue;
    const key = normalizeComparable(line);
    if (seen.has(key)) continue;
    seen.add(key);
    const date = extractIsoDate(line);
    const weight = line.match(/(\d{1,3}\s*%)/)?.[1];
    output.push({
      id: uid("sas"),
      include: true,
      type,
      title: line.replace(/\s+/g, " ").trim(),
      dueDate: date,
      weight,
      confidence: 0.55,
      warnings: date ? [] : ["date_not_confirmed"],
    });
  }
  return output.slice(0, 30);
}

function assessmentTypeFromText(value: string): SyllabusAssessmentType | undefined {
  if (/(?:מבחן|בחינה|exam|test|экзамен|зач[её]т)/i.test(value)) return "exam";
  if (/(?:מצגת|presentation|презентац)/i.test(value)) return "presentation";
  if (/(?:פרויקט|project|проект)/i.test(value)) return "project";
  if (/(?:מטלה|תרגיל|assignment|homework|essay|задани|эссе)/i.test(value)) return "assignment";
  return undefined;
}

function normalizeAssessmentType(value: unknown): SyllabusAssessmentType {
  return value === "assignment" ||
    value === "exam" ||
    value === "presentation" ||
    value === "project" ||
    value === "other"
    ? value
    : "other";
}

function extractSection(text: string, headings: string[]): string | undefined {
  const lines = text.split("\n");
  const start = lines.findIndex((line) =>
    headings.some((heading) => normalizeComparable(line).includes(normalizeComparable(heading))),
  );
  if (start < 0) return undefined;
  const collected: string[] = [];
  for (let index = start + 1; index < lines.length && collected.length < 20; index += 1) {
    const line = lines[index].trim();
    if (!line) {
      if (collected.length > 0) break;
      continue;
    }
    if (line.length < 100 && /[:：]$/.test(line)) break;
    collected.push(line);
  }
  const value = collected.join("\n").trim();
  return value || undefined;
}

function parseSafeNumber(value: string): number | undefined {
  const number = Number(value.replace(",", "."));
  return Number.isFinite(number) && number >= 0 && number <= 30 ? number : undefined;
}

function extractIsoDate(value: string): string | undefined {
  const iso = value.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (iso) return normalizeDate(`${iso[1]}-${iso[2]}-${iso[3]}`);
  const dayFirst = value.match(/\b(\d{1,2})[/.](\d{1,2})[/.](20\d{2})\b/);
  if (dayFirst) return normalizeDate(`${dayFirst[3]}-${dayFirst[2]}-${dayFirst[1]}`);
  return undefined;
}

function normalizeDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const match = value.match(/^(20\d{2})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return undefined;
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  return `${match[1]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function arrayOfObjects(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    : [];
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : [];
}

function topicDescription(topic: SyllabusTopicDraft): string {
  return [topic.week ? `Week: ${topic.week}` : "", topic.description ?? ""]
    .filter(Boolean)
    .join("\n");
}

function assessmentNotes(assessment: SyllabusAssessmentDraft): string {
  return [
    `Type: ${assessment.type}`,
    assessment.weight ? `Weight: ${assessment.weight}` : "",
    assessment.description ?? "",
  ]
    .filter(Boolean)
    .join("\n");
}

function composeCourseDescription(draft: CourseSyllabusDraft): string {
  const sections: string[] = [];
  if (draft.description?.trim()) sections.push(draft.description.trim());
  const readings = draft.readings
    .filter((reading) => reading.include && reading.citation.trim())
    .map((reading) => `- ${reading.citation.trim()}`);
  if (readings.length > 0) sections.push(`Readings\n${readings.join("\n")}`);
  if (draft.grading?.trim()) sections.push(`Grading\n${draft.grading.trim()}`);
  return sections.join("\n\n");
}
