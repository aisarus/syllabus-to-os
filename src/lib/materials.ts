// Legacy compat re-exports. New code should import from "./document-ingestion".
export {
  classifyFile,
  readFileAsText,
  extractTermSuggestions,
  formatFileSize,
} from "./document-ingestion";
