// Real, honest document ingestion.
// - TXT / MD / CSV / JSON / XML / HTML / YAML: read as text.
// - XLSX: SheetJS → readable per-sheet text.
// - DOCX: mammoth.js → extracts text/HTML from real .docx files.
// - PDF: pdfjs-dist → extracts text page by page. Empty result = likely scanned.
// - Anything else: honestly marked "unsupported"; user pastes text manually.
// No fake summaries, no fake AI.

import type {
  MaterialExtractionMethod,
  MaterialProcessingStatus,
  MaterialSourceLanguage,
} from "./store";

const TEXT_MIMES = new Set([
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "text/csv",
  "text/tab-separated-values",
  "application/json",
  "application/xml",
  "text/xml",
  "text/html",
  "application/x-yaml",
  "text/yaml",
]);

const TEXT_EXT_TO_METHOD: Record<string, MaterialExtractionMethod> = {
  txt: "txt",
  log: "txt",
  md: "markdown",
  markdown: "markdown",
  csv: "csv",
  tsv: "csv",
  json: "json",
  xml: "xml",
  html: "html",
  htm: "html",
  yaml: "yaml",
  yml: "yaml",
};

const BINARY_EXT_TO_METHOD: Record<string, MaterialExtractionMethod> = {
  xlsx: "xlsx",
  xls: "xlsx",
  docx: "docx",
  pdf: "pdf",
};

export interface IngestChunk {
  order: number;
  title?: string;
  text: string;
  pageNumber?: number;
  section?: string;
}

export interface IngestResult {
  rawText: string;
  chunks: IngestChunk[];
  status: MaterialProcessingStatus;
  message?: string;
  extractionMethod?: MaterialExtractionMethod;
  pageCount?: number;
  wordCount: number;
  charCount: number;
  sourceLanguage: MaterialSourceLanguage;
}

// ============ Public API ============

export function classifyFile(file: File): {
  isText: boolean;
  extractionMethod?: MaterialExtractionMethod;
} {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const mime = file.type || "";
  if (TEXT_MIMES.has(mime) || TEXT_EXT_TO_METHOD[ext] || mime.startsWith("text/")) {
    return { isText: true, extractionMethod: TEXT_EXT_TO_METHOD[ext] ?? "txt" };
  }
  if (BINARY_EXT_TO_METHOD[ext]) {
    return { isText: false, extractionMethod: BINARY_EXT_TO_METHOD[ext] };
  }
  return { isText: false };
}

export async function ingestFile(file: File): Promise<IngestResult> {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const cls = classifyFile(file);

  if (cls.isText) {
    try {
      const text = await readFileAsText(file);
      return finish(text, cls.extractionMethod ?? "txt");
    } catch (e) {
      return errorResult((e as Error).message);
    }
  }

  if (ext === "xlsx" || ext === "xls") {
    try {
      const { extractXlsx } = await import("./ingestion/xlsx");
      return await extractXlsx(file);
    } catch (e) {
      return errorResult((e as Error).message);
    }
  }
  if (ext === "docx") {
    try {
      const { extractDocx } = await import("./ingestion/docx");
      return await extractDocx(file);
    } catch (e) {
      return errorResult((e as Error).message);
    }
  }
  if (ext === "pdf") {
    try {
      const { extractPdf } = await import("./ingestion/pdf");
      return await extractPdf(file);
    } catch (e) {
      return errorResult((e as Error).message);
    }
  }

  return {
    rawText: "",
    chunks: [],
    status: "unsupported",
    message: "Text extraction for this file format is not connected yet.",
    wordCount: 0,
    charCount: 0,
    sourceLanguage: "unknown",
  };
}

export function ingestPastedText(text: string): IngestResult {
  return finish(text, "manual");
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

// ============ Chunking ============

export interface ChunkOptions {
  target?: number; // characters per chunk in fallback mode
  max?: number;
  section?: string; // apply to all chunks
  pageNumber?: number;
  titlePrefix?: string; // e.g. "Chunk", "Page", "Section"
  startOrder?: number;
}

/**
 * Split arbitrary text into readable chunks.
 * Strategy (in order):
 *   1) If Markdown-style headings are present, split by heading.
 *   2) Else, group paragraphs (double-newline separated) into ~target chars.
 *   3) Else, hard-window every 1200–1800 chars respecting sentence boundaries.
 */
export function createChunksFromText(text: string, opts: ChunkOptions = {}): IngestChunk[] {
  const clean = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!clean) return [];
  const target = opts.target ?? 1400;
  const max = opts.max ?? 1800;
  const startOrder = opts.startOrder ?? 0;
  const prefix = opts.titlePrefix ?? "Chunk";

  const headingChunks = splitByHeadings(clean);
  let raw: { title?: string; text: string }[] = [];
  if (headingChunks && headingChunks.length > 1) {
    raw = headingChunks;
  } else {
    raw = groupParagraphs(clean, target, max).map((t) => ({ text: t }));
  }

  // Split very long chunks further
  const expanded: { title?: string; text: string }[] = [];
  for (const c of raw) {
    if (c.text.length <= max) {
      expanded.push(c);
    } else {
      const parts = hardWindow(c.text, target, max);
      parts.forEach((p, i) => {
        expanded.push({ title: c.title ? `${c.title} (${i + 1})` : undefined, text: p });
      });
    }
  }

  return expanded
    .map((c, i) => ({
      order: startOrder + i,
      title: c.title || `${prefix} ${i + 1}`,
      text: c.text.trim(),
      pageNumber: opts.pageNumber,
      section: opts.section,
    }))
    .filter((c) => c.text.length > 0);
}

function splitByHeadings(text: string): { title?: string; text: string }[] | null {
  const lines = text.split("\n");
  const hasMdHeading = lines.some((l) => /^#{1,6}\s+\S/.test(l));
  if (!hasMdHeading) return null;
  const out: { title?: string; text: string }[] = [];
  let current: { title?: string; buf: string[] } = { buf: [] };
  const flush = () => {
    const body = current.buf.join("\n").trim();
    if (body) out.push({ title: current.title, text: body });
    current = { buf: [] };
  };
  for (const line of lines) {
    const m = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (m) {
      flush();
      current.title = m[2].trim();
    } else {
      current.buf.push(line);
    }
  }
  flush();
  return out;
}

function groupParagraphs(text: string, target: number, max: number): string[] {
  const paras = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paras.length === 0) return [];
  const out: string[] = [];
  let buf = "";
  for (const p of paras) {
    if (!buf) {
      buf = p;
      continue;
    }
    if (buf.length + 2 + p.length <= target) {
      buf += "\n\n" + p;
    } else if (buf.length < target * 0.6 && buf.length + 2 + p.length <= max) {
      // still small: extend once
      buf += "\n\n" + p;
    } else {
      out.push(buf);
      buf = p;
    }
  }
  if (buf) out.push(buf);
  return out;
}

function hardWindow(text: string, target: number, max: number): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(text.length, i + max);
    let cut = end;
    if (end < text.length) {
      // Prefer sentence boundary within [target, max]
      const window = text.slice(i + target, end);
      const rel = window.search(/[.!?…]\s|\n\n/);
      if (rel >= 0) {
        cut = i + target + rel + 1;
      } else {
        const spaceRel = window.lastIndexOf(" ");
        if (spaceRel > 0) cut = i + target + spaceRel;
      }
    }
    out.push(text.slice(i, cut).trim());
    i = cut;
  }
  return out.filter(Boolean);
}

// ============ Metrics + language guess ============

export function countWords(text: string): number {
  if (!text) return 0;
  const matches = text.match(/[\p{L}\p{N}]+/gu);
  return matches ? matches.length : 0;
}

export function guessLanguage(text: string): MaterialSourceLanguage {
  if (!text) return "unknown";
  const sample = text.slice(0, 4000);
  const cyr = (sample.match(/[\u0400-\u04FF]/g) || []).length;
  const heb = (sample.match(/[\u0590-\u05FF]/g) || []).length;
  const ara = (sample.match(/[\u0600-\u06FF]/g) || []).length;
  const lat = (sample.match(/[A-Za-z]/g) || []).length;
  const total = cyr + heb + ara + lat;
  if (total === 0) return "unknown";
  const scores: [MaterialSourceLanguage, number][] = [
    ["ru", cyr],
    ["he", heb],
    ["ar", ara],
    ["en", lat],
  ];
  scores.sort((a, b) => b[1] - a[1]);
  const [top, second] = scores;
  if (top[1] / total > 0.7) return top[0];
  if (second[1] / total > 0.2) return "mixed";
  return top[0];
}

// ============ Formatting ============

export function formatFileSize(bytes?: number): string {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

// ============ Term suggestions (kept from old materials.ts) ============

const STOP = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "into",
  "over",
  "under",
  "such",
  "will",
  "have",
  "has",
  "was",
  "were",
  "are",
  "but",
  "not",
  "you",
  "your",
  "our",
  "their",
  "his",
  "her",
  "its",
  "как",
  "что",
  "это",
  "или",
  "если",
  "так",
  "тот",
  "эта",
  "эти",
  "они",
  "мы",
  "вы",
  "он",
  "она",
  "оно",
]);

export function extractTermSuggestions(text: string, limit = 20): string[] {
  if (!text) return [];
  const tokens = text.match(/[A-ZА-Я][A-Za-zА-Яа-я0-9-]{2,}|[A-Z]{2,}/g) || [];
  const counts = new Map<string, number>();
  for (const raw of tokens) {
    const token = raw.trim();
    if (token.length < 3) continue;
    if (STOP.has(token.toLowerCase())) continue;
    counts.set(token, (counts.get(token) || 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([w]) => w);
}

// ============ Internals ============

function finish(text: string, method: MaterialExtractionMethod): IngestResult {
  const clean = text || "";
  const chunks = createChunksFromText(clean);
  return {
    rawText: clean,
    chunks,
    status: clean.trim() ? "ready" : "no_text",
    extractionMethod: method,
    wordCount: countWords(clean),
    charCount: clean.length,
    sourceLanguage: guessLanguage(clean),
  };
}

function errorResult(message: string): IngestResult {
  return {
    rawText: "",
    chunks: [],
    status: "error",
    message,
    wordCount: 0,
    charCount: 0,
    sourceLanguage: "unknown",
  };
}
