import { join } from "node:path";
import { assert, runBrowserProof, writeTinyPng } from "./browser-proof-kit.mjs";

const materialId = "mat_multipage_replace";
const replacedPageId = "page_replace_one";
const untouchedPageId = "page_keep_two";
const replacedChunkId = "chunk_page_one";
const untouchedChunkId = "chunk_page_two";

function fixture() {
  const now = Date.now();
  const sourceChunkIds = [replacedChunkId, untouchedChunkId];
  return {
    version: 1,
    programs: [],
    courses: [],
    topics: [],
    assignments: [],
    materialOutputs: [],
    calendarEvents: [],
    studySessions: [],
    syllabusImports: [],
    quizAttempts: [],
    materials: [
      {
        id: materialId,
        title: "Multi-page replacement proof",
        type: "lecture",
        sourceMode: "uploaded_file",
        fileName: "2 images",
        mimeType: "application/x-lamdan-image-batch",
        fileSize: 136,
        tags: [],
        rawText: "First page text\n\nSecond page text",
        processingStatus: "ready",
        pageCount: 2,
        wordCount: 6,
        charCount: 33,
        extractionMethod: "manual",
        sourceLanguage: "en",
        visualPages: [
          {
            id: replacedPageId,
            order: 0,
            fileName: "old-first.png",
            mimeType: "image/png",
            fileSize: 68,
            status: "applied",
            sourceLanguage: "en",
            createdAt: now,
            updatedAt: now,
          },
          {
            id: untouchedPageId,
            order: 1,
            fileName: "second.png",
            mimeType: "image/png",
            fileSize: 68,
            status: "applied",
            sourceLanguage: "en",
            createdAt: now,
            updatedAt: now,
          },
        ],
        createdAt: now,
        updatedAt: now,
      },
    ],
    materialChunks: [
      {
        id: replacedChunkId,
        materialId,
        order: 0,
        title: "Page 1",
        text: "First page text",
        pageNumber: 1,
        section: `ocr:image-page:${replacedPageId}:ocr:paragraph`,
        createdAt: now,
      },
      {
        id: untouchedChunkId,
        materialId,
        order: 0,
        title: "Page 2",
        text: "Second page text",
        pageNumber: 2,
        section: `ocr:image-page:${untouchedPageId}:ocr:paragraph`,
        createdAt: now + 1,
      },
    ],
    notes: [
      {
        id: "note_multipage",
        title: "Multi-page note",
        content: "Both pages",
        tags: [],
        materialId,
        sourceChunkIds,
        createdAt: now,
        updatedAt: now,
      },
    ],
    flashcards: [
      {
        id: "card_multipage",
        front: "Both?",
        back: "Both",
        materialId,
        sourceChunkIds,
        status: "new",
        dueAt: now,
        interval: 0,
        createdAt: now,
      },
    ],
    quizzes: [{ id: "quiz_multipage", title: "Multi-page quiz", materialId, createdAt: now }],
    quizQuestions: [
      {
        id: "question_multipage",
        quizId: "quiz_multipage",
        prompt: "Both?",
        options: ["A", "B", "C", "D"],
        correctIndex: 0,
        sourceChunkIds,
      },
    ],
    presentationOutlines: [
      {
        id: "outline_multipage",
        title: "Multi-page outline",
        materialId,
        slides: [
          {
            id: "slide_multipage",
            title: "Both pages",
            bullets: [],
            sourceChunkIds,
            order: 0,
          },
        ],
        createdAt: now,
        updatedAt: now,
      },
    ],
  };
}

async function seed(page) {
  await page.evaluate(`(() => {
    localStorage.clear();
    localStorage.setItem("lamdan.data.v1", ${JSON.stringify(JSON.stringify(fixture()))});
    localStorage.setItem("lamdan.lang", "ru");
    localStorage.setItem("lamdan.theme", "dark");
    return true;
  })()`);
}

async function readState(page) {
  return page.evaluate(`(() => {
    const data = JSON.parse(localStorage.getItem("lamdan.data.v1"));
    const material = data.materials.find((item) => item.id === ${JSON.stringify(materialId)});
    return {
      page: material.visualPages.find((item) => item.id === ${JSON.stringify(replacedPageId)}),
      replacedChunks: data.materialChunks.filter((chunk) =>
        chunk.section?.startsWith(${JSON.stringify(`ocr:image-page:${replacedPageId}:`)})
      ),
      untouchedChunks: data.materialChunks.filter((chunk) =>
        chunk.section?.startsWith(${JSON.stringify(`ocr:image-page:${untouchedPageId}:`)})
      ),
      references: [
        data.notes[0].sourceChunkIds,
        data.flashcards[0].sourceChunkIds,
        data.quizQuestions[0].sourceChunkIds,
        data.presentationOutlines[0].slides[0].sourceChunkIds,
      ],
    };
  })()`);
}

function assertState(state) {
  assert(state.page.fileName === "replacement-page.png", "Replacement filename was not saved.");
  assert(state.page.status === "awaiting_ocr", "Replaced page did not return to OCR review.");
  assert(state.replacedChunks.length === 0, "Replaced page kept stale OCR chunks.");
  assert(state.untouchedChunks.length === 1, "Unrelated page chunks were changed.");
  for (const ids of state.references) {
    assert(!ids.includes(replacedChunkId), "Replaced page left a dangling citation.");
    assert(ids.includes(untouchedChunkId), "Replacing one page removed another page's citation.");
  }
}

await runBrowserProof({
  name: "multipage-replacement",
  appPort: 4175,
  debugPort: 9335,
  execute: async ({ page, profileDir }) => {
    const replacementPath = join(profileDir, "replacement-page.png");
    await writeTinyPng(replacementPath);
    await seed(page);
    await page.navigate(`/app/materials/${materialId}`);
    await page.waitForText("Многостраничный фотоматериал");
    await page.clickAria("Заменить фото");
    await page.setFileInput('input[type="file"]:not([multiple])', replacementPath);
    await page.waitFor(`(() => {
      const data = JSON.parse(localStorage.getItem("lamdan.data.v1"));
      const material = data.materials.find((item) => item.id === ${JSON.stringify(materialId)});
      return material?.visualPages?.[0]?.fileName === "replacement-page.png";
    })()`);
    assertState(await readState(page));
    await page.reload();
    await page.waitForText("Многостраничный фотоматериал");
    assertState(await readState(page));
  },
});

console.log("✓ multi-page replacement preserves only valid citations after reload");
