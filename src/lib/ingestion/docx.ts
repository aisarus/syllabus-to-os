import mammoth from "mammoth";
import { throwIfIntakeCancelled } from "../intake-cancellation";
import {
  countWords,
  createChunksFromText,
  guessLanguage,
  type IngestResult,
} from "../document-ingestion";

export async function extractDocx(file: File, signal?: AbortSignal): Promise<IngestResult> {
  throwIfIntakeCancelled(signal);
  const arrayBuffer = await file.arrayBuffer();
  throwIfIntakeCancelled(signal);
  // mammoth in the browser accepts { arrayBuffer }.
  const result = await mammoth.extractRawText({ arrayBuffer });
  throwIfIntakeCancelled(signal);
  const text = (result.value || "").trim();

  if (!text) {
    return {
      rawText: "",
      chunks: [],
      status: "no_text",
      message: "DOCX contained no extractable text.",
      extractionMethod: "docx",
      wordCount: 0,
      charCount: 0,
      sourceLanguage: "unknown",
    };
  }

  const chunks = createChunksFromText(text, { titlePrefix: "Section" });
  return {
    rawText: text,
    chunks,
    status: "ready",
    extractionMethod: "docx",
    wordCount: countWords(text),
    charCount: text.length,
    sourceLanguage: guessLanguage(text),
  };
}
