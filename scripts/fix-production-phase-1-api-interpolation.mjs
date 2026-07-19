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
  const before = `\${${name}}`;
  const after = `\\\${${name}}`;
  content = content.replaceAll(before, after);
}
await writeFile(path, content, "utf8");
