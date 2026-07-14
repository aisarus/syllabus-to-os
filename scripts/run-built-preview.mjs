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
const nitroExecutable = resolve(
  process.cwd(),
  "node_modules",
  ".bin",
  process.platform === "win32" ? "nitro.cmd" : "nitro",
);

if (!existsSync(nitroExecutable)) {
  console.error(`Nitro preview executable was not found: ${nitroExecutable}`);
  process.exit(1);
}

console.log(`Starting built Lamdan server through Nitro preview: ${nitroExecutable}`);
console.log(`Listening on http://${host}:${port}`);

const child = spawn(nitroExecutable, ["preview"], {
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
