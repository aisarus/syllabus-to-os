import * as XLSX from "xlsx";
import {
  countWords,
  createChunksFromText,
  guessLanguage,
  type IngestChunk,
  type IngestResult,
} from "../document-ingestion";

export async function extractXlsx(file: File): Promise<IngestResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const parts: string[] = [];
  const chunks: IngestChunk[] = [];
  let order = 0;

  for (const name of wb.SheetNames) {
    const sh = wb.Sheets[name];
    if (!sh) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sh, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false,
    }) as string[][];
    if (rows.length === 0) continue;
    const widths = rows[0].map((_, ci) =>
      Math.min(30, Math.max(...rows.map((r) => String(r[ci] ?? "").length))),
    );
    const lines = rows.map((r) =>
      r.map((c, ci) => String(c ?? "").padEnd(widths[ci] ?? 0, " ")).join(" | ").trimEnd(),
    );
    const sheetText = lines.join("\n");
    const header = `## Sheet: ${name}`;
    parts.push(`${header}\n\n${sheetText}`);

    // If a sheet is small, one chunk; otherwise split into row groups.
    if (sheetText.length <= 1800) {
      chunks.push({
        order: order++,
        title: `Sheet: ${name}`,
        section: name,
        text: sheetText,
      });
    } else {
      const groupSize = 40;
      for (let i = 0; i < lines.length; i += groupSize) {
        const slice = lines.slice(i, i + groupSize).join("\n");
        chunks.push({
          order: order++,
          title: `Sheet: ${name} · rows ${i + 1}–${Math.min(lines.length, i + groupSize)}`,
          section: name,
          text: slice,
        });
      }
    }
  }

  const rawText = parts.join("\n\n");
  return {
    rawText,
    chunks: chunks.length > 0 ? chunks : createChunksFromText(rawText, { titlePrefix: "Sheet" }),
    status: rawText.trim() ? "ready" : "no_text",
    extractionMethod: "xlsx",
    wordCount: countWords(rawText),
    charCount: rawText.length,
    sourceLanguage: guessLanguage(rawText),
  };
}
