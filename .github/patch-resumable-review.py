from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f"marker not found in {path}: {old[:120]!r}")
    file.write_text(text.replace(old, new, 1))


workflow = Path(".github/workflows/resumable-transcription.yml")
workflow_text = workflow.read_text()
if "persist-credentials: false" not in workflow_text:
    workflow_text = workflow_text.replace(
        """      - name: Check out repository
        uses: actions/checkout@v4
""",
        """      - name: Check out repository
        uses: actions/checkout@v4
        with:
          persist-credentials: false
""",
        1,
    )
workflow.write_text(workflow_text)

replace_once(
    "src/components/long-media-data-boundary.tsx",
    """            (!stats?.mediaCount &&
              !stats?.automaticCandidateCount &&
              !stats?.resumableQueueCount)
""",
    """            (!stats?.mediaCount &&
              !stats?.transcriptCount &&
              !stats?.automaticCandidateCount &&
              !stats?.resumableQueueCount)
""",
)

panel = Path("src/components/resumable-transcription-panel.tsx")
panel_text = panel.read_text()
panel_text = panel_text.replace(
    """      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
""",
    """      } catch (error) {
        if (controller.signal.aborted) {
          current = await putResumableTranscriptionJob(
            cancelResumableRangeAttempt(
              current,
              queuedRange.id,
              isRu ? "Диапазон отменён пользователем." : "Range cancelled by the user.",
            ),
          );
          setJob(current);
          break;
        }
        const message = error instanceof Error ? error.message : String(error);
""",
    1,
)
panel_text = panel_text.replace(
    """  const loadMergedDraft = async () => {
    if (!job || !manifest) return;
""",
    """  const loadMergedDraft = async () => {
    if (!job || !manifest || job.status === "draft_loaded") return;
""",
    1,
)
panel_text = panel_text.replace(
    """              disabled={mergedSegments.length === 0 || Boolean(busyRangeId)}
""",
    """              disabled={
                mergedSegments.length === 0 ||
                Boolean(busyRangeId) ||
                job.status === "draft_loaded"
              }
""",
    1,
)
panel.write_text(panel_text)

model = Path("src/lib/resumable-transcription.ts")
model_text = model.read_text()
model_text = model_text.replace(
    """  ranges: ResumableTranscriptionRange[];
  createdAt: number;
""",
    """  ranges: ResumableTranscriptionRange[];
  revision: number;
  createdAt: number;
""",
    1,
)
model_text = model_text.replace(
    """  const rangeSeconds = input.rangeSeconds ?? DEFAULT_RESUMABLE_RANGE_SECONDS;
  const overlapSeconds = input.overlapSeconds ?? DEFAULT_RESUMABLE_OVERLAP_SECONDS;
  const ranges = planResumableTranscriptionRanges(
    input.manifest.durationSeconds,
    rangeSeconds,
    overlapSeconds,
  );
""",
    """  const requestedRangeSeconds = input.rangeSeconds ?? DEFAULT_RESUMABLE_RANGE_SECONDS;
  const requestedOverlapSeconds = input.overlapSeconds ?? DEFAULT_RESUMABLE_OVERLAP_SECONDS;
  const rangeSeconds = Math.max(60, Math.min(30 * 60, Math.round(requestedRangeSeconds)));
  const overlapSeconds = Math.max(0, Math.min(30, rangeSeconds / 4, requestedOverlapSeconds));
  const ranges = planResumableTranscriptionRanges(
    input.manifest.durationSeconds,
    rangeSeconds,
    overlapSeconds,
  );
""",
    1,
)
model_text = model_text.replace(
    """    rangeSeconds: Math.max(60, Math.min(30 * 60, Math.round(rangeSeconds))),
    overlapSeconds: Math.max(0, Math.min(30, overlapSeconds)),
    status: "planning",
    ranges,
    createdAt: now,
""",
    """    rangeSeconds,
    overlapSeconds,
    status: "planning",
    ranges,
    revision: 0,
    createdAt: now,
""",
    1,
)
merge_start = model_text.index("export function mergeResumableTranscriptionSegments(")
merge_end = model_text.index("\nexport function getResumableTranscriptionGaps", merge_start)
model_text = (
    model_text[:merge_start]
    + """export function mergeResumableTranscriptionSegments(
  job: ResumableTranscriptionJob,
): AutomaticTranscriptSegment[] {
  const candidates: RangeSegmentCandidate[] = job.ranges
    .filter((range) => range.status === "review_ready")
    .flatMap((range) =>
      range.resultSegments.map((segment) => ({
        rangeId: range.id,
        rangeStartSeconds: range.startSeconds,
        rangeEndSeconds: range.endSeconds,
        segment,
      })),
    )
    .sort(
      (left, right) =>
        left.segment.startSeconds - right.segment.startSeconds ||
        left.segment.endSeconds - right.segment.endSeconds,
    );
  const merged: RangeSegmentCandidate[] = [];

  for (const candidate of candidates) {
    const previous = merged.at(-1);
    if (previous && shouldMergeOverlap(previous, candidate, job.overlapSeconds)) {
      merged[merged.length - 1] = {
        ...previous,
        segment: {
          ...previous.segment,
          startSeconds: Math.min(previous.segment.startSeconds, candidate.segment.startSeconds),
          endSeconds: Math.max(previous.segment.endSeconds, candidate.segment.endSeconds),
          text: chooseMoreCompleteText(previous.segment.text, candidate.segment.text),
          speaker: previous.segment.speaker ?? candidate.segment.speaker,
          language: previous.segment.language ?? candidate.segment.language,
          uncertain: Boolean(previous.segment.uncertain || candidate.segment.uncertain),
          issues: Array.from(
            new Set([...(previous.segment.issues ?? []), ...(candidate.segment.issues ?? [])]),
          ),
        },
      };
      continue;
    }
    merged.push(candidate);
  }

  return normalizeAutomaticSegments(
    merged.map((candidate) => candidate.segment),
    job.durationSeconds,
  );
}
"""
    + model_text[merge_end:]
)
finalize_start = model_text.index("function finalizeJob(")
helper_start = model_text.index("\nfunction shouldMergeOverlap(", finalize_start)
model_text = (
    model_text[:finalize_start]
    + """export function deriveResumableTranscriptionJobStatus(
  ranges: ResumableTranscriptionRange[],
  currentStatus?: ResumableTranscriptionJobStatus,
): ResumableTranscriptionJobStatus {
  if (currentStatus === "draft_loaded") return "draft_loaded";
  const statuses = ranges.map((range) => range.status);
  if (statuses.every((value) => value === "review_ready")) return "review_ready";
  if (statuses.some((value) => value === "uploading" || value === "processing")) return "running";
  if (statuses.some((value) => value === "ready")) return "ready";
  if (statuses.some((value) => value === "review_ready")) return "partial_ready";
  if (statuses.every((value) => value === "cancelled")) return "cancelled";
  if (statuses.every((value) => value === "needs_file")) return "planning";
  return "paused";
}

function finalizeJob(job: ResumableTranscriptionJob): ResumableTranscriptionJob {
  return {
    ...job,
    status: deriveResumableTranscriptionJobStatus(job.ranges, job.status),
    updatedAt: Date.now(),
  };
}
"""
    + model_text[helper_start:]
)
old_helper_start = model_text.index("function shouldMergeOverlap(")
old_helper_end = model_text.index("\nfunction chooseMoreCompleteText", old_helper_start)
model_text = (
    model_text[:old_helper_start]
    + """interface RangeSegmentCandidate {
  rangeId: string;
  rangeStartSeconds: number;
  rangeEndSeconds: number;
  segment: AutomaticTranscriptSegment;
}

function shouldMergeOverlap(
  left: RangeSegmentCandidate,
  right: RangeSegmentCandidate,
  overlapSeconds: number,
): boolean {
  if (left.rangeId === right.rangeId) return false;
  const sharedStart = Math.max(left.rangeStartSeconds, right.rangeStartSeconds);
  const sharedEnd = Math.min(left.rangeEndSeconds, right.rangeEndSeconds);
  if (sharedEnd <= sharedStart) return false;
  if (sharedEnd - sharedStart > overlapSeconds + 0.01) return false;
  const tolerance = 1;
  const leftTouchesSharedRange =
    left.segment.endSeconds >= sharedStart - tolerance &&
    left.segment.startSeconds <= sharedEnd + tolerance;
  const rightTouchesSharedRange =
    right.segment.endSeconds >= sharedStart - tolerance &&
    right.segment.startSeconds <= sharedEnd + tolerance;
  if (!leftTouchesSharedRange || !rightTouchesSharedRange) return false;
  if (
    right.segment.startSeconds >
    left.segment.endSeconds + Math.max(tolerance, overlapSeconds + tolerance)
  ) {
    return false;
  }
  const leftText = normalizeText(left.segment.text);
  const rightText = normalizeText(right.segment.text);
  if (!leftText || !rightText) return false;
  return leftText === rightText || leftText.includes(rightText) || rightText.includes(leftText);
}
"""
    + model_text[old_helper_end:]
)
model.write_text(model_text)

store = Path("src/lib/resumable-transcription-store.ts")
store.write_text(
    '''import {
  deriveResumableTranscriptionJobStatus,
  type ResumableTranscriptionJob,
  type ResumableTranscriptionRange,
} from "./resumable-transcription";

const DATABASE_NAME = "lamdan-resumable-transcription";
const DATABASE_VERSION = 1;
const JOB_STORE = "jobs";

export async function getResumableTranscriptionJob(
  materialId: string,
): Promise<ResumableTranscriptionJob | undefined> {
  const db = await openDatabase();
  const record = await readRecord<ResumableTranscriptionJob>(db, materialId);
  return record ? normalizeJob(record) : undefined;
}

export async function putResumableTranscriptionJob(
  job: ResumableTranscriptionJob,
): Promise<ResumableTranscriptionJob> {
  const incoming = normalizeJob({ ...job, updatedAt: Date.now() });
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(JOB_STORE, "readwrite");
    const objectStore = transaction.objectStore(JOB_STORE);
    const request = objectStore.get(incoming.materialId);
    let persisted: ResumableTranscriptionJob | undefined;
    let mergeError: unknown;

    request.onsuccess = () => {
      try {
        persisted = mergeResumableTranscriptionJobsForPersistence(
          request.result as ResumableTranscriptionJob | undefined,
          incoming,
        );
        objectStore.put(persisted);
      } catch (error) {
        mergeError = error;
        transaction.abort();
      }
    };
    request.onerror = () => {
      mergeError = request.error ?? new Error("Could not read the persisted range queue.");
      transaction.abort();
    };
    transaction.oncomplete = () => {
      if (!persisted) {
        reject(new Error("The resumable transcription job was not persisted."));
        return;
      }
      resolve(persisted);
    };
    transaction.onerror = () =>
      reject(
        mergeError ??
          transaction.error ??
          new Error("Could not save the resumable transcription job."),
      );
    transaction.onabort = () =>
      reject(
        mergeError ??
          transaction.error ??
          new Error("Resumable transcription job save was aborted."),
      );
  });
}

export function mergeResumableTranscriptionJobsForPersistence(
  existingValue: ResumableTranscriptionJob | undefined,
  incomingValue: ResumableTranscriptionJob,
  now = Date.now(),
): ResumableTranscriptionJob {
  const incoming = normalizeJob(incomingValue);
  if (!existingValue) {
    return { ...incoming, revision: incoming.revision + 1, updatedAt: now };
  }
  const existing = normalizeJob(existingValue);
  if (
    existing.materialId !== incoming.materialId ||
    existing.sourceUploadId !== incoming.sourceUploadId
  ) {
    if (incoming.createdAt < existing.createdAt) {
      throw new Error("A stale resumable transcription job cannot replace a newer upload.");
    }
    return {
      ...incoming,
      revision: Math.max(existing.revision, incoming.revision) + 1,
      updatedAt: now,
    };
  }

  const rangeIds = new Set([
    ...existing.ranges.map((range) => range.id),
    ...incoming.ranges.map((range) => range.id),
  ]);
  const existingById = new Map(existing.ranges.map((range) => [range.id, range]));
  const incomingById = new Map(incoming.ranges.map((range) => [range.id, range]));
  const ranges = [...rangeIds]
    .map((rangeId) => choosePersistedRange(existingById.get(rangeId), incomingById.get(rangeId)))
    .filter((range): range is ResumableTranscriptionRange => Boolean(range))
    .sort((left, right) => left.index - right.index || left.startSeconds - right.startSeconds);
  const status = deriveResumableTranscriptionJobStatus(
    ranges,
    existing.status === "draft_loaded" || incoming.status === "draft_loaded"
      ? "draft_loaded"
      : incoming.status,
  );
  return {
    ...existing,
    ...incoming,
    ranges,
    status,
    revision: Math.max(existing.revision, incoming.revision) + 1,
    createdAt: Math.min(existing.createdAt, incoming.createdAt),
    updatedAt: now,
  };
}

function choosePersistedRange(
  existing: ResumableTranscriptionRange | undefined,
  incoming: ResumableTranscriptionRange | undefined,
): ResumableTranscriptionRange | undefined {
  if (!existing) return incoming;
  if (!incoming) return existing;
  if (incoming.attempt !== existing.attempt) {
    return incoming.attempt > existing.attempt ? incoming : existing;
  }
  const priority: Record<ResumableTranscriptionRange["status"], number> = {
    needs_file: 0,
    ready: 1,
    uploading: 2,
    processing: 3,
    cancelled: 4,
    failed: 4,
    review_ready: 5,
  };
  if (priority[incoming.status] !== priority[existing.status]) {
    return priority[incoming.status] > priority[existing.status] ? incoming : existing;
  }
  return incoming.updatedAt > existing.updatedAt ? incoming : existing;
}

export async function deleteResumableTranscriptionJob(materialId: string): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(JOB_STORE, "readwrite");
    transaction.objectStore(JOB_STORE).delete(materialId);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Could not delete the resumable transcription job."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Resumable transcription job deletion was aborted."));
  });
}

export async function listResumableTranscriptionJobs(): Promise<ResumableTranscriptionJob[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(JOB_STORE, "readonly");
    const request = transaction.objectStore(JOB_STORE).getAll();
    request.onsuccess = () =>
      resolve((request.result as ResumableTranscriptionJob[]).map((job) => normalizeJob(job)));
    request.onerror = () =>
      reject(request.error ?? new Error("Could not read resumable transcription jobs."));
  });
}

export async function pruneResumableTranscriptionJobs(
  validMaterialIds: Iterable<string>,
): Promise<number> {
  const valid = new Set(validMaterialIds);
  const jobs = await listResumableTranscriptionJobs();
  const orphanIds = jobs.filter((job) => !valid.has(job.materialId)).map((job) => job.materialId);
  for (const materialId of orphanIds) await deleteResumableTranscriptionJob(materialId);
  return orphanIds.length;
}

export async function clearResumableTranscriptionJobs(): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(JOB_STORE, "readwrite");
    transaction.objectStore(JOB_STORE).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Could not clear resumable transcription jobs."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Clearing resumable transcription jobs was aborted."));
  });
}

function normalizeJob(job: ResumableTranscriptionJob): ResumableTranscriptionJob {
  return {
    ...job,
    revision: Math.max(0, Number(job.revision) || 0),
    durationSeconds: Math.max(0, Number(job.durationSeconds) || 0),
    rangeSeconds: Math.max(60, Number(job.rangeSeconds) || 15 * 60),
    overlapSeconds: Math.max(0, Number(job.overlapSeconds) || 0),
    ranges: Array.isArray(job.ranges)
      ? job.ranges.map((range, index) => normalizeRange(range, index))
      : [],
    createdAt: Number(job.createdAt) || Date.now(),
    updatedAt: Number(job.updatedAt) || Date.now(),
  };
}

function normalizeRange(
  range: ResumableTranscriptionRange,
  fallbackIndex: number,
): ResumableTranscriptionRange {
  const startSeconds = Math.max(0, Number(range.startSeconds) || 0);
  const endSeconds = Math.max(startSeconds + 0.01, Number(range.endSeconds) || startSeconds + 1);
  return {
    ...range,
    id: range.id || `range_${fallbackIndex}_${Math.round(startSeconds * 1000)}`,
    index: Number.isInteger(range.index) ? range.index : fallbackIndex,
    startSeconds,
    endSeconds,
    attempt: Math.max(0, Number(range.attempt) || 0),
    uploadProgress: Math.max(0, Math.min(1, Number(range.uploadProgress) || 0)),
    resultSegments: Array.isArray(range.resultSegments) ? range.resultSegments : [],
    warnings: Array.from(new Set(Array.isArray(range.warnings) ? range.warnings : [])),
    updatedAt: Number(range.updatedAt) || Date.now(),
  };
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is not available in this browser."));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(JOB_STORE)) {
        db.createObjectStore(JOB_STORE, { keyPath: "materialId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not open resumable transcription storage."));
    request.onblocked = () =>
      reject(new Error("Resumable transcription storage is blocked by another tab."));
  });
}

function readRecord<T>(db: IDBDatabase, key: IDBValidKey): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(JOB_STORE, "readonly");
    const request = transaction.objectStore(JOB_STORE).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not read the resumable transcription job."));
  });
}
'''
)

evals = Path("scripts/run-resumable-transcription-evals.mjs")
eval_text = evals.read_text()
if "mergeResumableTranscriptionJobsForPersistence" not in eval_text:
    eval_text = eval_text.replace(
        '} from "../src/lib/resumable-transcription.ts";\n',
        '} from "../src/lib/resumable-transcription.ts";\nimport { mergeResumableTranscriptionJobsForPersistence } from "../src/lib/resumable-transcription-store.ts";\n',
        1,
    )
    tests = r'''

{
  const bounded = createResumableTranscriptionJob({
    manifest: { ...manifest, durationSeconds: 180 },
    providerStatus,
    requestSpeakerLabels: false,
    rangeSeconds: 60,
    overlapSeconds: 30,
  });
  assert.equal(bounded.rangeSeconds, 60);
  assert.equal(bounded.overlapSeconds, 15, "persisted overlap must match planner cap");
  assert.equal(bounded.ranges[1].startSeconds, 45);
}

{
  let repeated = createResumableTranscriptionJob({
    manifest: { ...manifest, durationSeconds: 60 },
    providerStatus,
    requestSpeakerLabels: false,
    rangeSeconds: 60,
    overlapSeconds: 0,
  });
  repeated = attachResumableRangeFile(
    repeated,
    repeated.ranges[0].id,
    { name: "repeat.mp3", size: 1000, type: "audio/mpeg" },
    providerStatus.maxBytes,
  );
  repeated = beginResumableRangeAttempt(repeated, repeated.ranges[0].id);
  repeated = completeResumableRangeAttempt(repeated, repeated.ranges[0].id, {
    ok: true,
    segments: [
      { id: "yes_1", startSeconds: 1, endSeconds: 2, text: "yes" },
      { id: "yes_2", startSeconds: 2.1, endSeconds: 3, text: "yes" },
    ],
  });
  assert.equal(
    mergeResumableTranscriptionSegments(repeated).length,
    2,
    "same-range repeated utterances must not be deduplicated",
  );
}

{
  const existing = {
    ...job,
    revision: 4,
    ranges: job.ranges.map((range, index) =>
      index === 0 ? { ...range, status: "review_ready", attempt: 1, updatedAt: 5000 } : range,
    ),
  };
  const stale = {
    ...job,
    revision: 2,
    ranges: job.ranges.map((range, index) =>
      index === 0 ? { ...range, status: "uploading", attempt: 1, updatedAt: 4000 } : range,
    ),
  };
  const persisted = mergeResumableTranscriptionJobsForPersistence(existing, stale, 6000);
  assert.equal(persisted.ranges[0].status, "review_ready");
  assert.equal(persisted.revision, 5);
}
'''
    marker = '\nconsole.log("Resumable long-file transcription deterministic evaluations passed.");'
    if marker not in eval_text:
        raise SystemExit("eval success marker not found")
    eval_text = eval_text.replace(marker, tests + marker, 1)
evals.write_text(eval_text)

contract = Path("scripts/verify-resumable-transcription-contract.mjs")
contract_text = contract.read_text()
replacements = [
    (
        '  "older lecture upload",\n',
        '  "older lecture upload",\n  "revision: number",\n  "deriveResumableTranscriptionJobStatus",\n  "left.rangeId === right.rangeId",\n',
    ),
    (
        '  "request.onblocked",\n',
        '  "request.onblocked",\n  "mergeResumableTranscriptionJobsForPersistence",\n  "choosePersistedRange",\n  "revision: Math.max",\n',
    ),
    (
        '  "putLongMediaTranscript",\n',
        '  "putLongMediaTranscript",\n  "controller.signal.aborted",\n  \'job.status === "draft_loaded"\',\n',
    ),
    (
        '  "range queues",\n',
        '  "range queues",\n  "transcriptCount",\n',
    ),
    (
        '  "Resumable long-file transcription deterministic evaluations passed",\n',
        '  "Resumable long-file transcription deterministic evaluations passed",\n  "same-range repeated utterances must not be deduplicated",\n  "persisted overlap must match planner cap",\n',
    ),
    (
        '  "Run resumable transcription browser E2E",\n',
        '  "Run resumable transcription browser E2E",\n  "persist-credentials: false",\n',
    ),
]
for old, new in replacements:
    if new.strip() not in contract_text:
        if old not in contract_text:
            raise SystemExit(f"contract marker not found: {old!r}")
        contract_text = contract_text.replace(old, new, 1)
contract.write_text(contract_text)

print("resumable review hardening applied")
