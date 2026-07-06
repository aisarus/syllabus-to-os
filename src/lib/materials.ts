// Real, honest material-processing helpers.
// - readFileAsText: reads TXT / Markdown / JSON / CSV / small text files.
// - Anything else (PDF / DOCX / XLSX / images / binary) is marked "unsupported"
//   with a clear message and the user can paste extracted text manually.
// - extractTermSuggestions: purely local heuristic — repeated capitalized /
//   technical tokens. Labeled as "suggestions", not AI.

import type { MaterialProcessingStatus } from "./store";

const TEXT_MIMES = new Set([
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "text/csv",
  "application/json",
  "application/xml",
  "text/xml",
  "text/html",
]);

const TEXT_EXTS = new Set([
  "txt",
  "md",
  "markdown",
  "csv",
  "tsv",
  "json",
  "xml",
  "html",
  "htm",
  "log",
  "yaml",
  "yml",
]);

export function classifyFile(file: File): {
  status: MaterialProcessingStatus;
  message: string;
  isText: boolean;
} {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const mime = file.type || "";
  const isText = TEXT_MIMES.has(mime) || TEXT_EXTS.has(ext) || mime.startsWith("text/");
  if (isText) {
    return { status: "ready", message: "", isText: true };
  }
  return {
    status: "unsupported",
    message:
      "File uploaded as source, but text extraction for this format is not connected yet. Paste extracted text below to work with it.",
    isText: false,
  };
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

// Simple local heuristic for terminology extraction.
// - Splits text into tokens.
// - Keeps capitalized words (or ALL-CAPS acronyms) that appear >=2 times.
// - Ignores very short and very common English/Russian stopwords.
const STOP = new Set([
  "the", "and", "for", "with", "that", "this", "from", "into", "over", "under",
  "such", "will", "have", "has", "was", "were", "are", "but", "not", "you",
  "your", "our", "their", "his", "her", "its",
  "как", "что", "это", "или", "если", "так", "тот", "эта", "эти", "они",
  "мы", "вы", "он", "она", "оно",
]);

export function extractTermSuggestions(text: string, limit = 20): string[] {
  if (!text) return [];
  const tokens = text.match(/[A-ZА-Я][A-Za-zА-Яа-я0-9\-]{2,}|[A-Z]{2,}/g) || [];
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

export function formatFileSize(bytes?: number): string {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
