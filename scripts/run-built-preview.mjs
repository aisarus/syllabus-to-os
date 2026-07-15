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
const outputDirectory = resolve(process.cwd(), ".output");
const workerEntry = resolve(outputDirectory, "server", "index.mjs");
const publicDirectory = resolve(outputDirectory, "public");
const npxExecutable = process.platform === "win32" ? "npx.cmd" : "npx";

if (!existsSync(workerEntry)) {
  console.error(`Built Cloudflare Worker entry was not found: ${workerEntry}`);
  console.error("Run `npm run build` before starting the production preview.");
  process.exit(1);
}

const configNames = ["wrangler.json", "wrangler.jsonc", "wrangler.toml"];
const configDirectories = [outputDirectory, resolve(outputDirectory, "server"), process.cwd()];
const configDirectory = configDirectories.find((directory) =>
  configNames.some((name) => existsSync(resolve(directory, name))),
);

const commonArguments = [
  "wrangler",
  ...(configDirectory ? ["--cwd", configDirectory] : []),
  "dev",
  ...(configDirectory ? [] : [workerEntry]),
  ...(configDirectory || !existsSync(publicDirectory) ? [] : ["--assets", publicDirectory]),
  "--ip",
  host,
  "--port",
  String(port),
  "--local",
  "--local-protocol",
  "http",
];

console.log(
  configDirectory
    ? `Starting built Lamdan Cloudflare Worker with config from ${configDirectory}`
    : `Starting built Lamdan Cloudflare Worker directly from ${workerEntry}`,
);
console.log(`Listening on http://${host}:${port}`);
console.log(`${npxExecutable} ${commonArguments.join(" ")}`);

const child = spawn(npxExecutable, commonArguments, {
  cwd: process.cwd(),
  env: {
    ...process.env,
    HOST: host,
    PORT: String(port),
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
