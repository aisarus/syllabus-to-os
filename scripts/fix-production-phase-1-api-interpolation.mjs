import { readFile, writeFile } from "node:fs/promises";

const path = "scripts/apply-production-phase-1-api.mjs";
let content = await readFile(path, "utf8");
for (const name of [
  "clientKey",
  "options.operation",
  "idempotencyKey",
  "prompt",
  "schemaDescription",
  "response.status",
  "marker",
  "route",
  "failure",
]) {
  const placeholder = "${" + name + "}";
  const escaped = "\\" + placeholder;
  const doubleEscaped = "\\\\" + placeholder;
  const pattern = new RegExp(
    "(?<!\\\\)\\$\\{" + name.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&") + "\\}",
    "g",
  );
  content = content.replaceAll(doubleEscaped, escaped).replace(pattern, escaped);
}
content = content.replace(
  "? `\\${clientKey}:\\${options.operation}:\\${idempotencyKey}`",
  "? \\`\\${clientKey}:\\${options.operation}:\\${idempotencyKey}\\`",
);
await writeFile(path, content, "utf8");
