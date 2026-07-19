import { throwIfIntakeCancelled } from "../intake-cancellation";
import {
  countWords,
  guessLanguage,
  type IngestChunk,
  type IngestResult,
} from "../document-ingestion";

// pdfjs-dist is browser-only and must run without SSR.
// We use the legacy build which ships plain JS suitable for eval-free bundling.

let workerConfigured = false;
async function loadPdfjs() {
  const pdfjsLib = await import("pdfjs-dist");
  if (!workerConfigured) {
    // Use a bundled worker URL. Vite handles the ?url import.
    // pdfjs-dist v4+ ships an .mjs worker.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - vite ?url import
    const workerSrc = (await import("pdfjs-dist/build/pdf.worker.mjs?url")).default;
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
    workerConfigured = true;
  }
  return pdfjsLib;
}

export async function extractPdf(file: File, signal?: AbortSignal): Promise<IngestResult> {
  throwIfIntakeCancelled(signal);
  const pdfjsLib = await loadPdfjs();
  const data = await file.arrayBuffer();
  throwIfIntakeCancelled(signal);
  const doc = await pdfjsLib.getDocument({ data }).promise;
  throwIfIntakeCancelled(signal);
  const pageCount = doc.numPages;

  const pages: string[] = [];
  const chunks: IngestChunk[] = [];
  let order = 0;

  for (let p = 1; p <= pageCount; p++) {
    throwIfIntakeCancelled(signal);
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    throwIfIntakeCancelled(signal);
    const items = content.items as Array<{ str: string; hasEOL?: boolean }>;
    let pageText = "";
    for (const it of items) {
      pageText += it.str;
      if (it.hasEOL) pageText += "\n";
      else pageText += " ";
    }
    pageText = pageText
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    pages.push(pageText);
    if (pageText) {
      chunks.push({
        order: order++,
        title: `Page ${p}`,
        pageNumber: p,
        text: pageText,
      });
    }
  }

  const rawText = pages
    .map((t, i) => (t ? `--- Page ${i + 1} ---\n${t}` : ""))
    .filter(Boolean)
    .join("\n\n");

  if (!rawText.trim()) {
    return {
      rawText: "",
      chunks: [],
      status: "no_text",
      message: "No text found. This may be a scanned PDF. Paste the text manually.",
      extractionMethod: "pdf",
      pageCount,
      wordCount: 0,
      charCount: 0,
      sourceLanguage: "unknown",
    };
  }

  return {
    rawText,
    chunks,
    status: "ready",
    extractionMethod: "pdf",
    pageCount,
    wordCount: countWords(rawText),
    charCount: rawText.length,
    sourceLanguage: guessLanguage(rawText),
  };
}
