import { assert, runBrowserProof } from "./browser-proof-kit.mjs";

const materialId = "mat_study_pack_path";
const chunkId = "chunk_study_pack_path";

const draft = {
  title: "Precision Study Pack",
  orientation: "This source explains precision.",
  orientationSourceChunkIds: [chunkId],
  estimatedMinutes: 25,
  steps: [
    {
      title: "Orient",
      purpose: "Understand the definition.",
      durationMinutes: 5,
      activity: "orient",
      sourceChunkIds: [chunkId],
    },
    {
      title: "Recall",
      purpose: "Retrieve the definition without looking.",
      durationMinutes: 5,
      activity: "recall",
      sourceChunkIds: [chunkId],
    },
  ],
  note: {
    title: "Precision",
    content: "Precision is the share of retrieved items that are relevant.",
    sourceChunkIds: [chunkId],
  },
  keyTerms: [
    {
      term: "Precision",
      explanation: "Relevant retrieved items divided by all retrieved items.",
      sourceChunkIds: [chunkId],
    },
  ],
  cards: [
    {
      front: "What does precision measure?",
      back: "The share of retrieved items that are relevant.",
      sourceChunkIds: [chunkId],
    },
  ],
  questions: [
    {
      prompt: "Which description matches precision?",
      options: [
        "Relevant among retrieved",
        "Retrieved among relevant",
        "All relevant",
        "All retrieved",
      ],
      correctIndex: 0,
      explanation: "Retrieved items are the denominator.",
      sourceChunkIds: [chunkId],
    },
  ],
  unclearAreas: [],
  warnings: [],
  notFoundInSources: false,
  trust: {
    model: "browser-proof",
    promptVersion: "study-pack-proof-v1",
    requestedSourceChunkIds: [chunkId],
    rejectedSourceChunkIds: [],
    uncitedItemCount: 0,
  },
};

function fixture() {
  const now = Date.now();
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
    notes: [],
    flashcards: [],
    quizzes: [],
    quizQuestions: [],
    presentationOutlines: [],
    materials: [
      {
        id: materialId,
        title: "Precision lecture",
        type: "lecture",
        sourceMode: "pasted_text",
        tags: [],
        rawText: "Precision is relevant retrieved divided by all retrieved items.",
        processingStatus: "ready",
        wordCount: 9,
        charCount: 63,
        extractionMethod: "manual",
        sourceLanguage: "en",
        createdAt: now,
        updatedAt: now,
      },
    ],
    materialChunks: [
      {
        id: chunkId,
        materialId,
        order: 0,
        title: "Precision definition",
        text: "Precision is relevant retrieved divided by all retrieved items.",
        section: "definition",
        createdAt: now,
      },
    ],
  };
}

async function clickExactButton(page, label) {
  const clicked = await page.evaluate(`(() => {
    const target = [...document.querySelectorAll("button")].find((button) =>
      button.getClientRects().length > 0 &&
      !button.disabled &&
      button.textContent?.replace(/\\s+/g, " ").trim() === ${JSON.stringify(label)}
    );
    if (!target) return false;
    target.click();
    return true;
  })()`);
  assert(clicked, `Could not click button: ${label}`);
}

async function waitForEnabledButton(page, label) {
  await page.waitFor(`[...document.querySelectorAll("button")].some((button) =>
    button.getClientRects().length > 0 &&
    !button.disabled &&
    button.textContent?.replace(/\\s+/g, " ").trim() === ${JSON.stringify(label)}
  )`);
}

await runBrowserProof({
  name: "study-pack-continuation",
  appPort: 4176,
  debugPort: 9336,
  execute: async ({ page }) => {
    await page.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `(() => {
        const originalFetch = window.fetch.bind(window);
        window.fetch = async (input, init) => {
          const url = typeof input === "string" ? input : input?.url ?? String(input);
          if (url.endsWith("/api/ai/status")) {
            return new Response(JSON.stringify({ configured: true, model: "browser-proof" }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }
          if (url.endsWith("/api/ai/generate-study-pack")) {
            return new Response(JSON.stringify({
              ok: true,
              draft: ${JSON.stringify(draft)},
              model: "browser-proof",
              promptVersion: "study-pack-proof-v1",
            }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }
          return originalFetch(input, init);
        };
      })();`,
    });
    await page.evaluate(`(() => {
      localStorage.clear();
      localStorage.setItem("lamdan.data.v1", ${JSON.stringify(JSON.stringify(fixture()))});
      localStorage.setItem("lamdan.lang", "ru");
      localStorage.setItem("lamdan.theme", "dark");
      return true;
    })()`);

    await page.navigate(`/app/materials/${materialId}`);
    await page.waitForText("Precision lecture");
    await page.evaluate(`(() => {
      for (const details of document.querySelectorAll("details")) details.open = true;
      return true;
    })()`);
    await waitForEnabledButton(page, "Подготовить меня по этой лекции");
    await clickExactButton(page, "Подготовить меня по этой лекции");
    await waitForEnabledButton(page, "Собрать учебный комплект");
    await clickExactButton(page, "Собрать учебный комплект");
    await page.waitForText("Чистовой конспект");
    await waitForEnabledButton(page, "Сохранить");
    await clickExactButton(page, "Сохранить");
    await page.waitForText("Продолжить занятие");

    const saved = await page.evaluate(`(() => {
      const data = JSON.parse(localStorage.getItem("lamdan.data.v1"));
      const note = data.notes.find((item) => item.materialId === ${JSON.stringify(materialId)});
      const quiz = data.quizzes.find((item) => item.materialId === ${JSON.stringify(materialId)});
      const links = [...document.querySelectorAll("a")].map((link) => link.getAttribute("href"));
      return {
        noteId: note?.id,
        quizId: quiz?.id,
        flashcards: data.flashcards.filter((item) => item.materialId === ${JSON.stringify(materialId)}).length,
        questions: data.quizQuestions.filter((item) => item.quizId === quiz?.id).length,
        links,
      };
    })()`);
    assert(saved.noteId, "Study Pack did not persist a note.");
    assert(saved.quizId, "Study Pack did not persist a diagnostic quiz.");
    assert(saved.flashcards === 1, "Study Pack continuation count does not match saved cards.");
    assert(saved.questions === 1, "Study Pack continuation count does not match saved questions.");
    assert(
      saved.links.includes(`/app/notes/${saved.noteId}`),
      "Saved note continuation link is missing.",
    );
    assert(saved.links.includes("/app/flashcards"), "Flashcard continuation link is missing.");
    assert(
      saved.links.includes(`/app/quizzes/${saved.quizId}`),
      "Diagnostic continuation link is missing.",
    );

    const opened = await page.evaluate(`(() => {
      const target = document.querySelector(${JSON.stringify('a[href^="/app/notes/"]')});
      if (!target) return false;
      target.click();
      return true;
    })()`);
    assert(opened, "Could not open the saved Study Pack note.");
    await page.waitFor(`location.pathname === ${JSON.stringify(`/app/notes/${saved.noteId}`)}`);
    await page.waitForText("Precision Study Pack");
  },
});

console.log("✓ Study Pack save continues into the exact saved learning outputs");
