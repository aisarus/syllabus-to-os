import assert from "node:assert/strict";
import JSZip from "jszip";
import {
  FULL_WORKSPACE_BACKUP_FORMAT,
  FULL_WORKSPACE_BACKUP_VERSION,
  mergeWorkspaceEvidenceSafely,
  prepareFullVisualBackup,
} from "../src/lib/workspace-backup.ts";

const encoder = new TextEncoder();

function coreData() {
  const now = 1_700_000_000_000;
  return {
    version: 1,
    programs: [],
    courses: [
      {
        id: "crs_1",
        title: "Evidence course",
        status: "in_progress",
        order: 0,
        createdAt: now,
      },
    ],
    topics: [],
    notes: [],
    flashcards: [],
    quizzes: [{ id: "quiz_1", title: "Quiz", courseId: "crs_1", createdAt: now }],
    quizQuestions: [
      {
        id: "qq_1",
        quizId: "quiz_1",
        prompt: "Question",
        options: ["A", "B", "C", "D"],
        correctIndex: 0,
        sourceChunkIds: ["chk_1"],
      },
    ],
    quizAttempts: [
      {
        id: "att_1",
        quizId: "quiz_1",
        score: 100,
        correctCount: 1,
        total: 1,
        takenAt: now,
      },
    ],
    assignments: [],
    materials: [
      {
        id: "mat_1",
        title: "Source",
        type: "lecture",
        sourceMode: "pasted_text",
        courseId: "crs_1",
        tags: [],
        rawText: "Evidence",
        processingStatus: "ready",
        wordCount: 1,
        charCount: 8,
        extractionMethod: "manual",
        sourceLanguage: "en",
        createdAt: now,
        updatedAt: now,
      },
    ],
    materialChunks: [
      { id: "chk_1", materialId: "mat_1", order: 0, text: "Evidence", createdAt: now },
    ],
    materialOutputs: [],
    presentationOutlines: [],
    calendarEvents: [],
    studySessions: [],
    syllabusImports: [],
  };
}

function conceptData() {
  return {
    version: 1,
    concepts: [
      {
        id: "con_1",
        courseId: "crs_1",
        title: "Concept",
        aliases: [],
        sourceChunkIds: ["chk_1"],
        flashcardIds: [],
        quizQuestionIds: ["qq_1"],
        createdAt: 1,
        updatedAt: 1,
      },
    ],
    evidenceEvents: [
      {
        id: "cev_1",
        conceptId: "con_1",
        kind: "recognition",
        outcome: "success",
        sourceType: "quiz_question_answer",
        sourceId: "att_1",
        attemptId: "att_1",
        questionId: "qq_1",
        occurredAt: 1,
      },
    ],
  };
}

function detailData() {
  return {
    version: 1,
    attempts: [
      {
        attemptId: "att_1",
        quizId: "quiz_1",
        mode: "trainer",
        createdAt: 1,
        answers: [
          {
            questionId: "qq_1",
            questionPrompt: "Question",
            selectedIndex: 0,
            selectedOption: "A",
            correctIndex: 0,
            correctOption: "A",
            correct: true,
            sourceChunkIds: ["chk_1"],
          },
        ],
      },
    ],
  };
}

async function createLegacyZip() {
  const zip = new JSZip();
  const dataBytes = encoder.encode(JSON.stringify(coreData(), null, 2));
  zip.file("data.json", dataBytes);
  zip.file(
    "manifest.json",
    JSON.stringify(
      {
        format: "lamdan-full-backup",
        version: 1,
        createdAt: new Date(0).toISOString(),
        appDataVersion: 1,
        files: [
          {
            path: "data.json",
            kind: "data",
            size: dataBytes.byteLength,
            sha256: await sha256(dataBytes),
          },
        ],
        materials: [],
      },
      null,
      2,
    ),
  );
  return new Blob([await zip.generateAsync({ type: "uint8array" })], {
    type: "application/zip",
  });
}

async function createWorkspaceZip({ tamperConcept = false } = {}) {
  const legacy = new Uint8Array(await (await createLegacyZip()).arrayBuffer());
  const conceptBytes = encoder.encode(JSON.stringify(conceptData(), null, 2));
  const detailBytes = encoder.encode(JSON.stringify(detailData(), null, 2));
  const zip = new JSZip();
  const files = [
    {
      path: "workspace/visual-backup-v1.zip",
      kind: "visualBackup",
      bytes: legacy,
    },
    {
      path: "workspace/concept-evidence.json",
      kind: "conceptEvidence",
      bytes: conceptBytes,
    },
    {
      path: "workspace/quiz-attempt-details.json",
      kind: "quizAttemptDetails",
      bytes: detailBytes,
    },
  ];
  for (const file of files) {
    zip.file(
      file.path,
      tamperConcept && file.kind === "conceptEvidence"
        ? encoder.encode('{"version":1,"concepts":[],"evidenceEvents":[]}')
        : file.bytes,
    );
  }
  zip.file(
    "workspace-manifest.json",
    JSON.stringify(
      {
        format: FULL_WORKSPACE_BACKUP_FORMAT,
        version: FULL_WORKSPACE_BACKUP_VERSION,
        createdAt: new Date(0).toISOString(),
        legacyVisualFormat: "lamdan-full-backup",
        legacyVisualVersion: 1,
        conceptEvidenceVersion: 1,
        quizAttemptDetailsVersion: 1,
        files: await Promise.all(
          files.map(async (file) => ({
            path: file.path,
            kind: file.kind,
            size: file.bytes.byteLength,
            sha256: await sha256(file.bytes),
          })),
        ),
      },
      null,
      2,
    ),
  );
  return new Blob([await zip.generateAsync({ type: "uint8array" })], {
    type: "application/zip",
  });
}

{
  const prepared = await prepareFullVisualBackup(await createWorkspaceZip());
  assert.equal(prepared.source, "workspace-v2");
  assert.equal(prepared.includesEvidence, true);
  assert.equal(prepared.legacy.data.courses.length, 1);
  assert.equal(prepared.conceptEvidence.concepts.length, 1);
  assert.equal(prepared.conceptEvidence.evidenceEvents.length, 1);
  assert.equal(prepared.quizAttemptDetails.attempts.length, 1);
  assert.equal(prepared.quizAttemptDetails.attempts[0].answers.length, 1);
}

{
  await assert.rejects(
    () => prepareFullVisualBackup(createWorkspaceZip({ tamperConcept: true })),
    /checksum mismatch/i,
    "tampered evidence payload must be rejected before import",
  );
}

{
  const legacy = await prepareFullVisualBackup(await createLegacyZip());
  assert.equal(legacy.source, "legacy-v1");
  assert.equal(legacy.includesEvidence, false);
  assert.ok(legacy.warnings.some((warning) => warning.includes("Merge keeps current evidence")));
}

{
  const currentConcepts = conceptData();
  const incomingConcepts = {
    ...conceptData(),
    evidenceEvents: [
      ...conceptData().evidenceEvents,
      {
        ...conceptData().evidenceEvents[0],
        id: "cev_incoming_for_conflict",
      },
    ],
  };
  const currentDetails = detailData();
  const incomingDetails = detailData();
  const merged = mergeWorkspaceEvidenceSafely(
    currentConcepts,
    incomingConcepts,
    currentDetails,
    incomingDetails,
    coreData(),
  );
  assert.ok(merged.conflicts.includes("concept: con_1"));
  assert.ok(merged.conflicts.includes("quiz attempt detail: att_1"));
  assert.equal(merged.conceptEvidence.concepts.length, 1);
  assert.equal(
    merged.conceptEvidence.evidenceEvents.some((event) => event.id === "cev_incoming_for_conflict"),
    false,
    "evidence for a conflicting concept must not be mixed in",
  );
}

console.log("Workspace backup v2 evaluations passed.");

async function sha256(bytes) {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
