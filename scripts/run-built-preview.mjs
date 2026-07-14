import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

function readArgument(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  const equals = process.argv.find((value) => value.startsWith(`${name}=`));
  return equals ? equals.slice(name.length + 1) : fallback;
}

const host = readArgument("--host", process.env.HOST || process.env.NITRO_HOST || "127.0.0.1");
const port = readArgument("--port", process.env.PORT || process.env.NITRO_PORT || "4173");
const candidates = [
  ".output/server/index.mjs",
  ".output/server/index.js",
  ".output/server/server.mjs",
  "dist/server/server.js",
  "dist/server/index.mjs",
  "dist/server/index.js",
];
const entry = candidates.map((candidate) => resolve(process.cwd(), candidate)).find(existsSync);

if (!entry) {
  console.error(
    `No built Lamdan server entry was found. Checked:\n${candidates.map((item) => `- ${item}`).join("\n")}`,
  );
  process.exit(1);
}

console.log(`Starting built Lamdan server: ${entry}`);
console.log(`Listening on http://${host}:${port}`);

const child = spawn(process.execPath, [entry], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    HOST: host,
    PORT: String(port),
    NITRO_HOST: host,
    NITRO_PORT: String(port),
  },
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (!child.killed) child.kill(signal);
  });
}

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
