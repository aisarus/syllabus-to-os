import { readFile, writeFile } from "node:fs/promises";

const path = "scripts/apply-production-phase-1-cancellation.mjs";
let content = await readFile(path, "utf8");
content = content.replace(
  '  if (!files[path].includes(marker)) failures.push(`${path} is missing ${marker}`);',
  '  if (!files[path].includes(marker)) failures.push(\\`\\${path} is missing \\${marker}\\`);',
);
content = content.replace(
  '  failures.forEach((failure) => console.error(`- ${failure}`));',
  '  failures.forEach((failure) => console.error(\\`- \\${failure}\\`));',
);
await writeFile(path, content, "utf8");
