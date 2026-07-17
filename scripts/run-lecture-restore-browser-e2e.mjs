import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const sourcePath = new URL("./run-lecture-backup-browser-e2e.mjs", import.meta.url);
const temporaryDirectory = await mkdtemp(join(tmpdir(), "lamdan-lecture-restore-"));
const temporaryScript = join(temporaryDirectory, "run-restore-proof.mjs");

try {
  const source = await readFile(sourcePath, "utf8");
  const previousSetup = `    await page.waitFor("document.readyState === 'complete'");

    await page.evaluate(\`(async () => {`;
  const restoreSetup = `    await page.navigate("/app/dashboard");

    await page.evaluate(\`(async () => {`;
  const previousEnding = `    await page.reload();
    await page.waitForText("Потоковая копия лекции");
    const unchanged = await page.evaluate(\`(() => {
      const core = JSON.parse(localStorage.getItem("lamdan.data.v1"));
      return core.materialChunks.length === 0 && core.materials.some((item) => item.id === "mat_backup");
    })()\`);
    assert(unchanged, "Local export mutated core material or source chunks.");
    console.log("Streaming lecture backup Chromium E2E passed.");`;
  const restoreEnding = `    const dataNavigated = await page.evaluate(\`(() => {
      const target = [...document.querySelectorAll('a[href="/app/data"]')].find((element) =>
        element.getClientRects().length > 0
      ) ?? document.querySelector('a[href="/app/data"]');
      if (!target) return false;
      target.click();
      return true;
    })()\`);
    assert(dataNavigated, "Could not navigate to the Data route through the SPA link.");
    await page.waitForText("Восстановить streaming lecture bundle");
    const injected = await page.evaluate(\`(() => {
      const input = [...document.querySelectorAll('input[type="file"]')].find((element) =>
        String(element.accept).includes(".lamdan-lecture")
      );
      if (!input || !(window.__lectureBackupBlob instanceof Blob)) return false;
      const transfer = new DataTransfer();
      transfer.items.add(new File([window.__lectureBackupBlob], "restore-fixture.lamdan-lecture", {
        type: "application/x-lamdan-lecture-backup"
      }));
      input.files = transfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()\`);
    assert(injected, "Could not inject the verified lecture bundle into restore UI.");
    await page.waitForText("streaming-fixture.wav");
    await page.waitForText("editable draft");
    await page.clickText("Восстановить как новую лекцию");
    await page.waitFor(\`(() => {
      const core = JSON.parse(localStorage.getItem("lamdan.data.v1"));
      return core.materials.some((item) => item.id !== "mat_backup" && item.tags?.includes("restored-backup"));
    })()\`, 60_000);

    const restoreProof = await page.evaluate(\`(async () => {
      const core = JSON.parse(localStorage.getItem("lamdan.data.v1"));
      const restored = core.materials.find((item) =>
        item.id !== "mat_backup" && item.tags?.includes("restored-backup")
      );
      if (!restored) throw new Error("Restored material is missing");

      const mediaDb = await openDb("lamdan-long-media");
      const manifest = await read(mediaDb, "manifests", restored.id);
      const chunks = await readByIndex(mediaDb, "chunks", "by-upload", manifest.uploadId);
      const transcript = await read(mediaDb, "transcripts", restored.id);
      mediaDb.close();

      const autoDb = await openDb("lamdan-automatic-transcription");
      const automaticJob = await read(autoDb, "jobs", restored.id);
      autoDb.close();

      const rangeDb = await openDb("lamdan-resumable-transcription");
      const rangeJob = await read(rangeDb, "jobs", restored.id);
      const clips = await readByIndex(rangeDb, "local-clips", "by-material", restored.id);
      rangeDb.close();

      return {
        restored,
        manifest,
        chunks: chunks.map((chunk) => ({
          index: chunk.index,
          size: chunk.size,
          uploadId: chunk.uploadId,
          materialId: chunk.materialId,
          sha256: chunk.sha256
        })),
        transcript,
        automaticJob,
        rangeJob,
        clips: clips.map((clip) => ({
          materialId: clip.materialId,
          sourceUploadId: clip.sourceUploadId,
          rangeId: clip.rangeId,
          size: clip.size
        })),
        sourceStillPresent: core.materials.some((item) => item.id === "mat_backup"),
        sourceChunkCount: core.materialChunks.length
      };

      function openDb(name) {
        return new Promise((resolve, reject) => {
          const request = indexedDB.open(name);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      }
      function read(db, storeName, key) {
        return new Promise((resolve, reject) => {
          const request = db.transaction(storeName, "readonly").objectStore(storeName).get(key);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      }
      function readByIndex(db, storeName, indexName, key) {
        return new Promise((resolve, reject) => {
          const request = db
            .transaction(storeName, "readonly")
            .objectStore(storeName)
            .index(indexName)
            .getAll(key);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      }
    })()\`);

    assert(restoreProof.sourceStillPresent, "Restore replaced the existing source material.");
    assert(restoreProof.restored.courseId === undefined, "Restore kept a dangling archived course id.");
    assert(restoreProof.restored.topicId === undefined, "Restore kept a dangling archived topic id.");
    assert(restoreProof.manifest.materialId === restoreProof.restored.id, "Manifest material id was not rewritten.");
    assert(restoreProof.manifest.uploadId !== "media_backup", "Restore reused the archived upload id.");
    assert(restoreProof.chunks.length === 3, "Restore did not stage all raw media chunks.");
    assert(
      restoreProof.chunks.every((chunk, index) =>
        chunk.index === index &&
        chunk.uploadId === restoreProof.manifest.uploadId &&
        chunk.materialId === restoreProof.restored.id &&
        chunk.size === 65536 &&
        /^[a-f0-9]{64}$/.test(chunk.sha256)
      ),
      "Restored raw chunk identity or hashes are invalid.",
    );
    assert(
      restoreProof.transcript.materialId === restoreProof.restored.id &&
        restoreProof.transcript.sourceUploadId === restoreProof.manifest.uploadId,
      "Transcript identity was not rewritten.",
    );
    assert(
      restoreProof.automaticJob.materialId === restoreProof.restored.id &&
        restoreProof.automaticJob.sourceUploadId === restoreProof.manifest.uploadId,
      "Automatic candidate identity was not rewritten.",
    );
    assert(
      restoreProof.rangeJob.materialId === restoreProof.restored.id &&
        restoreProof.rangeJob.sourceUploadId === restoreProof.manifest.uploadId,
      "Resumable queue identity was not rewritten.",
    );
    assert(
      restoreProof.clips.length === 1 &&
        restoreProof.clips[0].materialId === restoreProof.restored.id &&
        restoreProof.clips[0].sourceUploadId === restoreProof.manifest.uploadId,
      "Local range clips were not restored under the new identity.",
    );
    assert(restoreProof.sourceChunkCount === 0, "Restore auto-created source chunks.");

    await page.reload();
    await page.waitForText("Streaming lecture fixture (restored)");
    console.log("Staged lecture restore Chromium E2E passed.");`;

  if (!source.includes(previousSetup)) {
    throw new Error("Could not locate the lecture backup fixture setup.");
  }
  if (!source.includes(previousEnding)) {
    throw new Error("Could not locate the lecture backup proof ending.");
  }
  const compatible = source
    .replace("const APP_PORT = 4187;", "const APP_PORT = 4188;")
    .replace("const DEBUG_PORT = 9347;", "const DEBUG_PORT = 9348;")
    .replace(previousSetup, restoreSetup)
    .replace(previousEnding, restoreEnding);
  await writeFile(temporaryScript, compatible);
  const result = spawnSync(process.execPath, [temporaryScript], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true }).catch(() => undefined);
}
