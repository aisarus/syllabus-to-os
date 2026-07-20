import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const server = createServer((request, response) => {
  response.setHeader("content-type", "application/json");
  if (request.url === "/api/ai/status") {
    response.end(JSON.stringify({ ok: true, provider: "test-ai", configured: true }));
    return;
  }
  if (request.url === "/api/ai/transcription-status") {
    response.end(JSON.stringify({ ok: true, provider: "test-audio", configured: false }));
    return;
  }
  response.statusCode = 404;
  response.end(JSON.stringify({ ok: false }));
});
await new Promise((resolveReady) => server.listen(0, "127.0.0.1", resolveReady));
const address = server.address();
if (!address || typeof address === "string") throw new Error("Mock server did not start.");
const evidenceDir = await mkdtemp(resolve(tmpdir(), "lamdan-pilot-evidence-"));
try {
  const run = await runNode(
    [
      "scripts/run-pilot-preflight.mjs",
      "--base-url",
      `http://127.0.0.1:${address.port}`,
      "--course",
      "Test Course",
      "--institution",
      "Test University",
      "--evidence-dir",
      evidenceDir,
      "--commit",
      "abcdef1",
      "--browser-device",
      "Chromium desktop",
      "--provenance",
      "licensed-test-fixture",
    ],
    { ...process.env, LAMDAN_PILOT_LIVE_OCR_READY: "1" },
  );
  assert.equal(run.code, 0, run.stderr || run.stdout);
  const manifest = JSON.parse(
    await readFile(resolve(evidenceDir, "00-preflight/pilot-session.json"), "utf8"),
  );
  assert.equal(manifest.appCommit, "abcdef1");
  assert.equal(manifest.providerSnapshot.ai.reachable, true);
  assert.equal(manifest.providerSnapshot.transcription.body.configured, false);
  assert.equal(manifest.externalGates.liveOcr, "ready");
  assert.equal(manifest.externalGates.goldenQuiz, "blocked");
  assert.equal(manifest.evidencePlan.length, 9);

  const insideRepo = await runNode([
    "scripts/run-pilot-preflight.mjs",
    "--base-url",
    `http://127.0.0.1:${address.port}`,
    "--course",
    "Test Course",
    "--institution",
    "Test University",
    "--evidence-dir",
    resolve(process.cwd(), ".pilot-private"),
    "--commit",
    "abcdef1",
  ]);
  assert.equal(insideRepo.code, 1);
  assert.match(insideRepo.stderr, /outside the repository/u);
} finally {
  server.close();
  await rm(evidenceDir, { recursive: true, force: true });
}
console.log("Pilot preflight manifest and private-evidence boundary evaluations passed.");

function runNode(args, env = process.env) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", rejectRun);
    child.once("close", (code) => resolveRun({ code, stdout, stderr }));
  });
}
