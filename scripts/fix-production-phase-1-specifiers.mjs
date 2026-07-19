import { readFile, writeFile } from "node:fs/promises";

const replacements = new Map([
  [
    "src/lib/store.ts",
    [
      ['from "./persistence-health"', 'from "./persistence-health.ts"'],
      ['from "./source-reference-safety"', 'from "./source-reference-safety.ts"'],
      ['from "./source-integrity"', 'from "./source-integrity.ts"'],
    ],
  ],
  ["src/lib/source-reference-safety.ts", [['from "./store"', 'from "./store.ts"']]],
  ["src/lib/workspace-repository.ts", [['from "./store"', 'from "./store.ts"']]],
  [
    "src/lib/source-safe-store.ts",
    [
      ['from "./source-reference-safety"', 'from "./source-reference-safety.ts"'],
      ['from "./store"', 'from "./store.ts"'],
      ['from "./workspace-repository"', 'from "./workspace-repository.ts"'],
    ],
  ],
]);

for (const [path, pairs] of replacements) {
  let content = await readFile(path, "utf8");
  for (const [before, after] of pairs) {
    if (!content.includes(before)) throw new Error(`Missing ${before} in ${path}`);
    content = content.replaceAll(before, after);
  }
  await writeFile(path, content, "utf8");
}
