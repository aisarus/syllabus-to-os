// Deterministic syllabus parser for Israeli university / college program files.
// Reads XLSX workbooks (via SheetJS types) and produces a clean ParsedSyllabusDraft:
// program metadata, semester groups, courses with number/title/credits/instructor,
// plus an inspector list of ignored rows.
//
// No AI, no network, no fake behavior. Every classification decision is recorded
// with a reason so the UI can surface it.

import type { WorkBook } from "xlsx";
import * as XLSX from "xlsx";

export const PARSER_VERSION = "det-1.0.0";

// ============ Types ============

export type ClassifiedRowType =
  | "empty_row"
  | "title_row"
  | "header_row"
  | "semester_section_row"
  | "course_row"
  | "total_credits_row"
  | "notes_row"
  | "unknown_row";

export interface ClassifiedRow {
  sheetName: string;
  rowIndex: number; // 0-based within the sheet
  cells: string[];
  detectedType: ClassifiedRowType;
  confidence: number; // 0..1
  reasons: string[];
}

export interface DetectedColumns {
  headerRowIndex?: number;
  courseNumberColumn?: number;
  titleColumn?: number;
  creditsColumn?: number;
  instructorColumn?: number;
  notesColumn?: number;
  typeColumn?: number;
  semesterColumn?: number;
  yearColumn?: number;
  prerequisitesColumn?: number;
  descriptionColumn?: number;
}

export interface ParsedSemesterDraft {
  id: string;
  title: string;
  year?: number;
  semester?: string; // "A" | "B" | "Summer" | etc.
  creditsTotal?: number;
  order: number;
  source?: { sheetName: string; rowIndex: number };
}

export interface ParsedCourseDraft {
  id: string;
  include: boolean;
  title: string;
  originalTitle?: string;
  number?: string;
  semesterId?: string; // ref to ParsedSemesterDraft.id
  year?: number;
  semester?: string;
  credits?: number;
  type?: string;
  instructor?: string;
  prerequisites?: string;
  description?: string;
  notes?: string;
  topics: string[];
  confidence: number;
  warnings: string[];
  source: {
    sheetName: string;
    rowIndex: number;
    originalCells: string[];
  };
}

export interface IgnoredRow {
  id: string;
  sheetName: string;
  rowIndex: number;
  detectedType: ClassifiedRowType;
  reason: string;
  cells: string[];
  confidence: number;
}

export interface ParsedSyllabusDraft {
  id: string;
  sourceFileName: string;
  parserVersion: string;
  parserType: "deterministic" | "ai_assisted";
  confidence: number;
  institution?: string;
  programName?: string;
  degree?: string;
  warnings: string[];
  semesters: ParsedSemesterDraft[];
  courses: ParsedCourseDraft[];
  ignoredRows: IgnoredRow[];
  detectedSheetName?: string;
  stats: {
    detectedSemesters: number;
    detectedCourses: number;
    warnings: number;
    lowConfidenceCourses: number;
  };
}

// ============ Vocabulary ============

const HEADER_LABELS = {
  courseNumber: [
    "מספר קורס",
    "מס' קורס",
    'מס"ק',
    "מס קורס",
    "קוד קורס",
    "course number",
    "course no",
    "course code",
    "code",
    "no",
    "#",
    "номер курса",
    "код курса",
    "№",
  ],
  title: [
    "שם קורס",
    "שם הקורס",
    "שם",
    "כותרת",
    "course name",
    "course title",
    "title",
    "name",
    "subject",
    "название курса",
    "название",
    "наименование",
  ],
  credits: [
    'נ"ז',
    "נ״ז",
    "נז",
    "נקודות זכות",
    "נקודות",
    'נק"ז',
    "נק״ז",
    "credits",
    "points",
    "credit",
    "cr",
    "кредиты",
    "з.е.",
    "зачетные единицы",
  ],
  instructor: [
    "מרצה",
    "מרצים",
    "שם המרצה",
    "instructor",
    "lecturer",
    "teacher",
    "professor",
    "преподаватель",
    "лектор",
  ],
  notes: ["הערות", "הערה", "notes", "remarks", "comments", "примечания", "заметки"],
  semester: ["סמסטר", "semester", "term", "семестр"],
  year: ["שנה", "שנת לימוד", "year", "год", "курс"],
  type: ["סוג", "סוג קורס", "type", "course type", "тип"],
  prerequisites: ["דרישות קדם", "קדם", "prerequisites", "prereq", "pre-req", "пререквизиты"],
  description: ["תיאור", "תיאור קורס", "description", "overview", "описание"],
};

const SEMESTER_KEYWORDS_HE = [
  "שנה א",
  "שנה ב",
  "שנה ג",
  "שנה ד",
  "סמסטר א",
  "סמסטר ב",
  "סמסטר קיץ",
  "סמסטר ג",
  "קורסי חובה",
  "קורסי בחירה",
  "סמינריונים",
  "פרויקט גמר",
  "חובות",
  "בחירה",
  "חובה",
];
const SEMESTER_KEYWORDS_EN = [
  "year 1",
  "year 2",
  "year 3",
  "year 4",
  "semester a",
  "semester b",
  "semester c",
  "summer semester",
  "fall semester",
  "spring semester",
  "required courses",
  "elective courses",
  "seminars",
  "final project",
];
const SEMESTER_KEYWORDS_RU = [
  "1 курс",
  "2 курс",
  "3 курс",
  "4 курс",
  "семестр а",
  "семестр б",
  "летний семестр",
  "обязательные курсы",
  "курсы по выбору",
];

const TOTAL_KEYWORDS = [
  'סה"כ',
  "סה״כ",
  "סהכ",
  "סך הכל",
  'סה"כ נ"ז',
  "סה״כ נ״ז",
  "total",
  "subtotal",
  "credits total",
  "grand total",
  "итого",
  "всего",
];

// ============ Helpers ============

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

function cleanCell(v: unknown): string {
  if (v == null) return "";
  return String(v).replace(/\s+/g, " ").trim();
}

function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/["׳״'`]/g, "")
    .replace(/[.,:;·•]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsAny(text: string, list: string[]): boolean {
  const n = normalizeForMatch(text);
  return list.some((label) => n.includes(normalizeForMatch(label)));
}

function equalsAny(text: string, list: string[]): boolean {
  const n = normalizeForMatch(text);
  return list.some((label) => n === normalizeForMatch(label));
}

export function normalizeCourseNumber(text: string): string | undefined {
  const s = cleanCell(text);
  if (!s) return undefined;
  // Accept: 615, 01-234-56, 89-123, 01.234.56
  const m = s.match(/^\s*(\d{1,4}([-.]\d{2,4}){0,3})\s*$/);
  if (m) return m[1];
  // Also accept if the cell is purely numeric with maybe surrounding spaces
  if (/^\d{1,6}$/.test(s)) return s;
  return undefined;
}

function looksLikeCourseNumberCell(text: string): boolean {
  return normalizeCourseNumber(text) !== undefined;
}

export function parseCredits(value: unknown): number | undefined {
  if (value == null) return undefined;
  if (typeof value === "number") {
    if (Number.isFinite(value) && value >= 0 && value <= 30) return value;
    return undefined;
  }
  const s = String(value).trim().replace(",", ".");
  if (!s) return undefined;
  const m = s.match(/^\s*(\d{1,2}(?:\.\d{1,2})?)\s*$/);
  if (!m) return undefined;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 0 || n > 30) return undefined;
  return n;
}

function looksLikeCreditsCell(text: string): boolean {
  return parseCredits(text) !== undefined;
}

function looksLikeInstructorCell(text: string): boolean {
  const n = normalizeForMatch(text);
  if (!n) return false;
  if (/(^|\s)(ד"?ר|ד״ר|פרופ|מר|גב|dr\.?|prof\.?|mr\.?|ms\.?|mrs\.?)(\s|$)/i.test(n)) return true;
  // heuristic: multiple words, contains no digits, has letters
  if (n.length > 3 && n.length < 60 && !/\d/.test(n) && /\s/.test(n)) return true;
  return false;
}

// ============ Semester label normalization ============

export interface NormalizedSemesterLabel {
  title: string;
  year?: number;
  semester?: string; // "A" | "B" | "Summer" | undefined
}

const HE_YEAR_LETTERS: Record<string, number> = { א: 1, ב: 2, ג: 3, ד: 4 };
const HE_SEMESTER_LETTERS: Record<string, string> = { א: "A", ב: "B", ג: "C" };

export function normalizeSemesterLabel(text: string): NormalizedSemesterLabel {
  const raw = cleanCell(text);
  const stripped = raw.replace(/["׳״'`]/g, "");
  const n = stripped.toLowerCase();

  let year: number | undefined;
  let semester: string | undefined;

  // Hebrew: שנה X סמסטר Y
  const heYear = stripped.match(/שנה\s*([אבגד])/);
  if (heYear) year = HE_YEAR_LETTERS[heYear[1]];

  const heSem = stripped.match(/סמסטר\s*([אבגד])/);
  if (heSem) semester = HE_SEMESTER_LETTERS[heSem[1]];

  if (/סמסטר\s*קיץ/.test(stripped)) semester = "Summer";

  // English
  const enYear = n.match(/year\s*(\d)/);
  if (enYear) year = year ?? Number(enYear[1]);
  const enSem = n.match(/semester\s*([abc])/);
  if (enSem) semester = semester ?? enSem[1].toUpperCase();
  if (/summer\s+semester/.test(n)) semester = "Summer";
  if (/fall\s+semester/.test(n)) semester = semester ?? "A";
  if (/spring\s+semester/.test(n)) semester = semester ?? "B";

  // Russian
  const ruYear = n.match(/(\d)\s*курс/);
  if (ruYear) year = year ?? Number(ruYear[1]);
  const ruSem = n.match(/семестр\s*([аб])/);
  if (ruSem) semester = semester ?? (ruSem[1] === "а" ? "A" : "B");

  return { title: raw, year, semester };
}

// ============ Row classification ============

export function isEmptyRow(cells: string[]): boolean {
  return cells.every((c) => !c || !c.trim());
}

function countNonEmpty(cells: string[]): number {
  return cells.filter((c) => c && c.trim()).length;
}

export function isTotalRow(cells: string[]): boolean {
  const joined = cells.join(" ");
  return containsAny(joined, TOTAL_KEYWORDS);
}

export function isSemesterSectionRow(cells: string[]): boolean {
  const joined = cells.filter(Boolean).join(" ");
  if (!joined) return false;
  // A semester section row typically has few filled cells and matches semester keywords
  const filled = countNonEmpty(cells);
  const hasSem =
    containsAny(joined, SEMESTER_KEYWORDS_HE) ||
    containsAny(joined, SEMESTER_KEYWORDS_EN) ||
    containsAny(joined, SEMESTER_KEYWORDS_RU);
  if (!hasSem) return false;
  // If the row also looks like a course row (has course number + long title elsewhere), skip
  const hasCourseNumber = cells.some(looksLikeCourseNumberCell);
  if (hasCourseNumber && filled >= 3) return false;
  return true;
}

const ALL_HEADER_LABELS = Object.values(HEADER_LABELS).flat();

function countHeaderMatches(cells: string[]): number {
  let n = 0;
  for (const c of cells) {
    if (!c) continue;
    if (equalsAny(c, ALL_HEADER_LABELS)) n++;
  }
  return n;
}

export function isHeaderRow(cells: string[]): boolean {
  return countHeaderMatches(cells) >= 2;
}

export function isNotesRow(cells: string[]): boolean {
  const filled = cells.filter(Boolean);
  if (filled.length === 0) return false;
  const joined = filled.join(" ");
  const n = normalizeForMatch(joined);
  // Only classify as notes if the row starts with a notes marker and is short
  return (
    (n.startsWith("הערה") ||
      n.startsWith("הערות") ||
      n.startsWith("note") ||
      n.startsWith("notes") ||
      n.startsWith("примечан")) &&
    filled.length <= 2
  );
}

export function isLikelyCourseRow(cells: string[], columns?: DetectedColumns): boolean {
  const filled = countNonEmpty(cells);
  if (filled < 2) return false;

  // If we know columns, require a plausible title in the title column
  if (columns?.titleColumn != null) {
    const t = cleanCell(cells[columns.titleColumn]);
    if (!t) return false;
    if (looksLikeCourseNumberCell(t)) return false; // title must not be just a number
    if (equalsAny(t, ALL_HEADER_LABELS)) return false;
    if (containsAny(t, SEMESTER_KEYWORDS_HE) || containsAny(t, SEMESTER_KEYWORDS_EN)) return false;
    return true;
  }

  // No columns yet: heuristic. Need a course-number-looking cell + a text cell.
  const hasNumber = cells.some(looksLikeCourseNumberCell);
  const hasText = cells.some((c) => {
    const s = cleanCell(c);
    if (!s || s.length < 3) return false;
    if (looksLikeCourseNumberCell(s)) return false;
    if (equalsAny(s, ALL_HEADER_LABELS)) return false;
    if (/\d/.test(s) && s.length < 5) return false;
    return /[א-תA-Za-zА-я]/.test(s);
  });
  return hasNumber && hasText;
}

// ============ Column detection ============

function scoreHeader(cell: string, labels: string[]): number {
  if (!cell) return 0;
  const n = normalizeForMatch(cell);
  for (const l of labels) {
    const nl = normalizeForMatch(l);
    if (n === nl) return 3;
    if (n.includes(nl)) return 2;
  }
  return 0;
}

function bestColumnByHeader(headerRow: string[], labels: string[]): number | undefined {
  let best = -1;
  let bestScore = 0;
  headerRow.forEach((c, i) => {
    const s = scoreHeader(c, labels);
    if (s > bestScore) {
      bestScore = s;
      best = i;
    }
  });
  return best >= 0 ? best : undefined;
}

export function detectColumns(headerRow: string[] | undefined, rows: string[][]): DetectedColumns {
  const cols: DetectedColumns = {};
  if (headerRow && headerRow.some(Boolean)) {
    cols.courseNumberColumn = bestColumnByHeader(headerRow, HEADER_LABELS.courseNumber);
    cols.titleColumn = bestColumnByHeader(headerRow, HEADER_LABELS.title);
    cols.creditsColumn = bestColumnByHeader(headerRow, HEADER_LABELS.credits);
    cols.instructorColumn = bestColumnByHeader(headerRow, HEADER_LABELS.instructor);
    cols.notesColumn = bestColumnByHeader(headerRow, HEADER_LABELS.notes);
    cols.typeColumn = bestColumnByHeader(headerRow, HEADER_LABELS.type);
    cols.semesterColumn = bestColumnByHeader(headerRow, HEADER_LABELS.semester);
    cols.yearColumn = bestColumnByHeader(headerRow, HEADER_LABELS.year);
    cols.prerequisitesColumn = bestColumnByHeader(headerRow, HEADER_LABELS.prerequisites);
    cols.descriptionColumn = bestColumnByHeader(headerRow, HEADER_LABELS.description);
  }

  // Content-based fallback for course number, credits, title, instructor
  const maxCols = Math.max(0, ...rows.map((r) => r.length));
  if (cols.courseNumberColumn == null) {
    let best = -1,
      bestScore = 0;
    for (let c = 0; c < maxCols; c++) {
      const score = rows.reduce(
        (acc, r) => acc + (looksLikeCourseNumberCell(r[c] ?? "") ? 1 : 0),
        0,
      );
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    if (bestScore >= Math.max(2, Math.floor(rows.length * 0.2))) cols.courseNumberColumn = best;
  }
  if (cols.creditsColumn == null) {
    let best = -1,
      bestScore = 0;
    for (let c = 0; c < maxCols; c++) {
      if (c === cols.courseNumberColumn) continue;
      const score = rows.reduce((acc, r) => acc + (looksLikeCreditsCell(r[c] ?? "") ? 1 : 0), 0);
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    if (bestScore >= Math.max(2, Math.floor(rows.length * 0.2))) cols.creditsColumn = best;
  }
  if (cols.titleColumn == null) {
    // Pick column with longest average non-numeric text
    let best = -1,
      bestScore = 0;
    for (let c = 0; c < maxCols; c++) {
      if (c === cols.courseNumberColumn || c === cols.creditsColumn) continue;
      let total = 0,
        n = 0;
      for (const r of rows) {
        const s = cleanCell(r[c] ?? "");
        if (!s) continue;
        if (looksLikeCourseNumberCell(s)) continue;
        if (looksLikeCreditsCell(s) && s.length <= 4) continue;
        if (/[א-תA-Za-zА-я]/.test(s)) {
          total += s.length;
          n++;
        }
      }
      const score = n > 0 ? total / n : 0;
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    if (best >= 0 && bestScore >= 4) cols.titleColumn = best;
  }
  if (cols.instructorColumn == null) {
    let best = -1,
      bestScore = 0;
    for (let c = 0; c < maxCols; c++) {
      if ([cols.courseNumberColumn, cols.titleColumn, cols.creditsColumn].includes(c)) continue;
      const score = rows.reduce((acc, r) => acc + (looksLikeInstructorCell(r[c] ?? "") ? 1 : 0), 0);
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    if (bestScore >= Math.max(2, Math.floor(rows.length * 0.15))) cols.instructorColumn = best;
  }
  return cols;
}

// ============ Header detection ============

export function detectHeaderRows(classified: ClassifiedRow[]): number[] {
  return classified.filter((c) => c.detectedType === "header_row").map((c) => c.rowIndex);
}

// ============ Main pipeline ============

function classifyInitial(sheetName: string, rows: string[][]): ClassifiedRow[] {
  return rows.map((cells, rowIndex) => {
    const reasons: string[] = [];
    let type: ClassifiedRowType = "unknown_row";
    let confidence = 0.3;

    if (isEmptyRow(cells)) {
      type = "empty_row";
      confidence = 1;
      reasons.push("row is empty");
    } else if (isHeaderRow(cells)) {
      type = "header_row";
      confidence = 0.95;
      reasons.push("matches known header labels");
    } else if (isSemesterSectionRow(cells)) {
      type = "semester_section_row";
      confidence = 0.9;
      reasons.push("matches semester/section keyword");
    } else if (isTotalRow(cells)) {
      type = "total_credits_row";
      confidence = 0.9;
      reasons.push("matches total keyword");
    } else if (isNotesRow(cells)) {
      type = "notes_row";
      confidence = 0.8;
      reasons.push("looks like a notes/remarks row");
    }

    return { sheetName, rowIndex, cells, detectedType: type, confidence, reasons };
  });
}

function pickBestSheet(workbook: WorkBook): string | undefined {
  let bestName: string | undefined;
  let bestScore = -1;
  for (const name of workbook.SheetNames) {
    const sh = workbook.Sheets[name];
    if (!sh) continue;
    const rows = XLSX.utils
      .sheet_to_json<unknown[]>(sh, { header: 1, raw: false, defval: "", blankrows: false })
      .map((r) => r.map(cleanCell));
    if (rows.length === 0) continue;
    const classified = classifyInitial(name, rows);
    const headers = classified.filter((c) => c.detectedType === "header_row").length;
    const sections = classified.filter((c) => c.detectedType === "semester_section_row").length;
    const candidates = classified.filter((c) => c.detectedType === "unknown_row").length;
    const score = headers * 3 + sections * 2 + candidates;
    if (score > bestScore) {
      bestScore = score;
      bestName = name;
    }
  }
  return bestName ?? workbook.SheetNames[0];
}

export interface ParseOptions {
  sourceFileName: string;
  preferredSheetName?: string;
}

export function parseWorkbookToSyllabusDraft(
  workbook: WorkBook,
  opts: ParseOptions,
): ParsedSyllabusDraft {
  const warnings: string[] = [];
  const sheetName = opts.preferredSheetName ?? pickBestSheet(workbook);
  const draft: ParsedSyllabusDraft = {
    id: uid("syl"),
    sourceFileName: opts.sourceFileName,
    parserVersion: PARSER_VERSION,
    parserType: "deterministic",
    confidence: 0.5,
    warnings,
    semesters: [],
    courses: [],
    ignoredRows: [],
    detectedSheetName: sheetName,
    stats: { detectedSemesters: 0, detectedCourses: 0, warnings: 0, lowConfidenceCourses: 0 },
  };

  if (!sheetName) {
    warnings.push("empty_workbook");
    draft.confidence = 0;
    return draft;
  }

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    warnings.push("sheet_not_found");
    return draft;
  }

  const rows: string[][] = XLSX.utils
    .sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "", blankrows: false })
    .map((r) => r.map(cleanCell));

  if (rows.length === 0) {
    warnings.push("sheet_has_no_rows");
    return draft;
  }

  const initial = classifyInitial(sheetName, rows);

  // Choose header row: first header_row found, else null
  const headerRows = initial.filter((c) => c.detectedType === "header_row");
  const primaryHeaderRow = headerRows[0];
  const columns = detectColumns(
    primaryHeaderRow?.cells,
    rows.filter(
      (_, i) =>
        initial[i]?.detectedType !== "header_row" &&
        initial[i]?.detectedType !== "semester_section_row" &&
        initial[i]?.detectedType !== "empty_row",
    ),
  );
  if (primaryHeaderRow) columns.headerRowIndex = primaryHeaderRow.rowIndex;

  // Second pass: refine unknown_row -> course_row using detected columns
  for (const row of initial) {
    if (row.detectedType !== "unknown_row") continue;
    if (isLikelyCourseRow(row.cells, columns)) {
      row.detectedType = "course_row";
      row.confidence = 0.75;
      row.reasons.push("matched course-row heuristic");
    }
  }

  // Build semester context and course drafts
  const semesters: ParsedSemesterDraft[] = [];
  const courses: ParsedCourseDraft[] = [];
  const ignored: IgnoredRow[] = [];

  let currentSemester: ParsedSemesterDraft | undefined;
  let currentCourseType: string | undefined;
  let semesterOrder = 0;

  const addIgnored = (row: ClassifiedRow, reason: string) => {
    ignored.push({
      id: uid("ign"),
      sheetName: row.sheetName,
      rowIndex: row.rowIndex,
      detectedType: row.detectedType,
      reason,
      cells: row.cells,
      confidence: row.confidence,
    });
  };

  for (const row of initial) {
    switch (row.detectedType) {
      case "empty_row":
        break;
      case "header_row":
        addIgnored(row, "header_row");
        break;
      case "title_row":
        addIgnored(row, "title_row");
        break;
      case "total_credits_row":
        addIgnored(row, "total_credits_row");
        break;
      case "notes_row":
        addIgnored(row, "notes_row");
        break;
      case "semester_section_row": {
        const joined = row.cells.filter(Boolean).join(" ").trim();
        const norm = normalizeSemesterLabel(joined);
        // Detect course type context
        if (/בחירה|elective/i.test(joined)) currentCourseType = "elective";
        else if (/חובה|required|обязат/i.test(joined)) currentCourseType = "required";
        else if (/סמינר|seminar/i.test(joined)) currentCourseType = "seminar";

        currentSemester = {
          id: uid("sem"),
          title: norm.title,
          year: norm.year,
          semester: norm.semester,
          order: semesterOrder++,
          source: { sheetName: row.sheetName, rowIndex: row.rowIndex },
        };
        semesters.push(currentSemester);
        break;
      }
      case "course_row": {
        const c = row.cells;
        const numRaw =
          columns.courseNumberColumn != null ? c[columns.courseNumberColumn] : undefined;
        const titleRaw = columns.titleColumn != null ? c[columns.titleColumn] : undefined;
        const creditsRaw = columns.creditsColumn != null ? c[columns.creditsColumn] : undefined;
        const instructorRaw =
          columns.instructorColumn != null ? c[columns.instructorColumn] : undefined;
        const notesRaw = columns.notesColumn != null ? c[columns.notesColumn] : undefined;
        const typeRaw = columns.typeColumn != null ? c[columns.typeColumn] : undefined;
        const preReqRaw =
          columns.prerequisitesColumn != null ? c[columns.prerequisitesColumn] : undefined;
        const descRaw =
          columns.descriptionColumn != null ? c[columns.descriptionColumn] : undefined;

        let title = cleanCell(titleRaw);
        // Fallback: pick the longest text cell that isn't the course number
        if (!title || looksLikeCourseNumberCell(title)) {
          const alt = c
            .map((cell, i) => ({ cell: cleanCell(cell), i }))
            .filter(
              ({ cell, i }) =>
                cell &&
                i !== columns.courseNumberColumn &&
                i !== columns.creditsColumn &&
                !looksLikeCourseNumberCell(cell) &&
                !looksLikeCreditsCell(cell) &&
                /[א-תA-Za-zА-я]/.test(cell),
            )
            .sort((a, b) => b.cell.length - a.cell.length)[0];
          if (alt) title = alt.cell;
        }
        // Reject headers/section labels/numeric-only strings as titles
        const titleNorm = normalizeForMatch(title);
        const isNumericOnly = /^\d+([-./]\d+)*$/.test(titleNorm);
        const isHeaderLabel = equalsAny(title, ALL_HEADER_LABELS);
        const isSectionLabel =
          containsAny(title, SEMESTER_KEYWORDS_HE) ||
          containsAny(title, SEMESTER_KEYWORDS_EN) ||
          containsAny(title, SEMESTER_KEYWORDS_RU) ||
          containsAny(title, TOTAL_KEYWORDS);
        if (!title || isNumericOnly || isHeaderLabel || isSectionLabel) {
          addIgnored(
            row,
            isNumericOnly
              ? "title_is_number"
              : isHeaderLabel
                ? "title_is_header_label"
                : isSectionLabel
                  ? "title_is_section_label"
                  : "no_title_detected",
          );
          break;
        }

        const number = normalizeCourseNumber(cleanCell(numRaw));
        const credits = parseCredits(creditsRaw);
        const instructor = cleanCell(instructorRaw) || undefined;

        const warns: string[] = [];
        if (!number) warns.push("no_course_number");
        if (credits == null) warns.push("no_credits");

        const confidence =
          0.4 + (number ? 0.3 : 0) + (credits != null ? 0.15 : 0) + (title.length > 5 ? 0.1 : 0);

        courses.push({
          id: uid("crs"),
          include: true,
          title,
          number,
          semesterId: currentSemester?.id,
          year: currentSemester?.year,
          semester: currentSemester?.semester ?? currentSemester?.title,
          credits,
          type: cleanCell(typeRaw) || currentCourseType || undefined,
          instructor,
          prerequisites: cleanCell(preReqRaw) || undefined,
          description: cleanCell(descRaw) || undefined,
          notes: cleanCell(notesRaw) || undefined,
          topics: [],
          confidence: Math.min(1, confidence),
          warnings: warns,
          source: {
            sheetName: row.sheetName,
            rowIndex: row.rowIndex,
            originalCells: row.cells,
          },
        });
        break;
      }
      case "unknown_row":
      default:
        addIgnored(row, "unclassified");
        break;
    }
  }

  // Aggregate semester credit totals
  for (const sem of semesters) {
    const total = courses
      .filter((c) => c.semesterId === sem.id && typeof c.credits === "number")
      .reduce((acc, c) => acc + (c.credits ?? 0), 0);
    sem.creditsTotal = total > 0 ? total : undefined;
  }

  // Program metadata: look at the first title row of the sheet
  const firstFilled = rows.find((r) => countNonEmpty(r) > 0);
  if (firstFilled) {
    const joined = firstFilled.filter(Boolean).join(" · ").trim();
    if (joined && !isHeaderRow(firstFilled) && !isSemesterSectionRow(firstFilled)) {
      draft.programName = joined.slice(0, 160);
    }
  }
  // Guess institution / degree from title
  if (draft.programName) {
    if (/בר\s*אילן|bar[\s-]?ilan/i.test(draft.programName))
      draft.institution = "Bar-Ilan University";
    else if (/הדסה|hadassah/i.test(draft.programName)) draft.institution = "Hadassah";
    else if (/העברית|hebrew/i.test(draft.programName)) draft.institution = "Hebrew University";
    if (/b\.?sc|בוגר/i.test(draft.programName)) draft.degree = "BSc";
    else if (/m\.?sc|מוסמך/i.test(draft.programName)) draft.degree = "MSc";
  }

  if (courses.length === 0) warnings.push("no_course_rows_detected");
  if (!primaryHeaderRow) warnings.push("header_row_not_detected");
  if (columns.creditsColumn == null) warnings.push("credits_column_unclear");
  const lowConf = courses.filter((c) => c.confidence < 0.6).length;
  if (lowConf > courses.length * 0.4 && courses.length > 0)
    warnings.push("many_low_confidence_rows");

  draft.semesters = semesters;
  draft.courses = courses;
  draft.ignoredRows = ignored;
  draft.stats = {
    detectedSemesters: semesters.length,
    detectedCourses: courses.length,
    warnings: warnings.length,
    lowConfidenceCourses: lowConf,
  };
  const avgConf =
    courses.length > 0 ? courses.reduce((a, c) => a + c.confidence, 0) / courses.length : 0;
  draft.confidence = Math.round(avgConf * 100) / 100;
  return draft;
}

// Read raw sheet rows (for the Advanced mode & AI payload)
export function readSheetRows(workbook: WorkBook, sheetName: string): string[][] {
  const sh = workbook.Sheets[sheetName];
  if (!sh) return [];
  return XLSX.utils
    .sheet_to_json<unknown[]>(sh, { header: 1, raw: false, defval: "", blankrows: false })
    .map((r) => r.map(cleanCell));
}

// Duplicate-detection helper
export function normalizedTitle(t: string): string {
  return t
    .toLowerCase()
    .replace(/["'`״׳]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
