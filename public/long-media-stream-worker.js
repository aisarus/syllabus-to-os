const DATABASE_NAME = "lamdan-long-media";
const DATABASE_VERSION = 1;
const MANIFEST_STORE = "manifests";
const CHUNK_STORE = "chunks";
const STREAM_PREFIX = "/__lamdan_media__/";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("message", (event) => {
  if (event.data?.type === "LAM_DAN_CLAIM_CLIENTS") {
    event.waitUntil(self.clients.claim());
  }
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(STREAM_PREFIX)) return;
  if (event.request.method !== "GET" && event.request.method !== "HEAD") {
    event.respondWith(new Response("Method not allowed", { status: 405 }));
    return;
  }
  event.respondWith(handleMediaRequest(event.request, url));
});

async function handleMediaRequest(request, url) {
  try {
    const materialId = decodeURIComponent(url.pathname.slice(STREAM_PREFIX.length));
    if (!materialId) return new Response("Missing material id", { status: 400 });
    const expectedUploadId = url.searchParams.get("uploadId");
    const db = await openDatabase();
    const manifest = await readRecord(db, MANIFEST_STORE, materialId);
    if (!manifest) return new Response("Recording not found", { status: 404 });
    if (expectedUploadId && manifest.uploadId !== expectedUploadId) {
      return new Response("Recording version changed", { status: 409 });
    }

    const range = parseRangeHeader(request.headers.get("range"), manifest.size);
    if (range === null) {
      return new Response(null, {
        status: 416,
        headers: {
          "Content-Range": `bytes */${manifest.size}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": "no-store",
        },
      });
    }
    const { start, end, partial } = range;
    const length = end - start + 1;
    const headers = new Headers({
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store",
      "Content-Length": String(length),
      "Content-Type": manifest.mimeType || "application/octet-stream",
      "X-Lamdan-Upload-Id": manifest.uploadId,
    });
    if (partial) headers.set("Content-Range", `bytes ${start}-${end}/${manifest.size}`);
    if (request.method === "HEAD") {
      db.close();
      return new Response(null, { status: partial ? 206 : 200, headers });
    }

    const stream = createRangeStream(db, manifest, start, end);
    return new Response(stream, { status: partial ? 206 : 200, headers });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : String(error), { status: 500 });
  }
}

function parseRangeHeader(header, size) {
  if (!Number.isFinite(size) || size <= 0) return null;
  if (!header) return { start: 0, end: size - 1, partial: false };
  const match = /^bytes=(\d*)-(\d*)$/i.exec(header.trim());
  if (!match) return null;
  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) return null;
  let start;
  let end;
  if (!rawStart) {
    const suffixLength = Number(rawEnd);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return null;
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd ? Number(rawEnd) : size - 1;
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start >= size) return null;
  end = Math.min(size - 1, end);
  if (end < start) return null;
  return { start, end, partial: true };
}

function createRangeStream(db, manifest, start, end) {
  let offset = start;
  let closed = false;
  return new ReadableStream({
    async pull(controller) {
      if (closed) return;
      if (offset > end) {
        closed = true;
        db.close();
        controller.close();
        return;
      }
      try {
        const index = Math.floor(offset / manifest.chunkSize);
        const record = await readRecord(db, CHUNK_STORE, [manifest.uploadId, index]);
        if (!record?.blob) throw new Error(`Lecture chunk ${index} is missing.`);
        const chunkStart = index * manifest.chunkSize;
        const localStart = offset - chunkStart;
        const localEnd = Math.min(record.blob.size, end - chunkStart + 1);
        if (localEnd <= localStart)
          throw new Error(`Lecture chunk ${index} does not cover the range.`);
        const bytes = new Uint8Array(await record.blob.slice(localStart, localEnd).arrayBuffer());
        offset += bytes.byteLength;
        controller.enqueue(bytes);
      } catch (error) {
        closed = true;
        db.close();
        controller.error(error);
      }
    },
    cancel() {
      if (!closed) db.close();
      closed = true;
    },
  });
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not open lecture-media storage."));
    request.onblocked = () => reject(new Error("Lecture-media storage is blocked by another tab."));
  });
}

function readRecord(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not read lecture-media storage."));
  });
}
