import assert from "node:assert/strict";
import {
  buildReviewCandidates,
  extractStudyPackConceptCandidates,
  findConceptDuplicate,
  normalizeConceptCandidate,
  parseStudyPackKeyTerms,
  planConceptCandidateAcceptance,
} from "../src/lib/concept-extraction.ts";

const existing = {
  id: "con_existing",
  courseId: "crs_1",
  title: "Separation of powers",
  description: "Existing",
  aliases: ["הפרדת רשויות"],
  sourceChunkIds: ["chk_1"],
  flashcardIds: [],
  quizQuestionIds: [],
  createdAt: 1,
  updatedAt: 1,
};

{
  const terms = parseStudyPackKeyTerms(`# Pack

## Ключевые термины

- **Разделение властей** — распределение полномочий между ветвями власти.
- **Судебный контроль** — проверка решений судами.

## Что требует проверки
- другое`);
  assert.deepEqual(terms, [
    {
      term: "Разделение властей",
      explanation: "распределение полномочий между ветвями власти.",
    },
    { term: "Судебный контроль", explanation: "проверка решений судами." },
  ]);
}

{
  const terms = parseStudyPackKeyTerms(`## Key terms
- **Information retrieval** — finding relevant records.
- malformed line`);
  assert.equal(terms.length, 1);
  assert.equal(terms[0].term, "Information retrieval");
}

{
  const normalized = normalizeConceptCandidate(
    {
      title: "  Judicial review  ",
      description: "  Courts review a decision.  ",
      aliases: ["Judicial review", "ביקורת שיפוטית", "ביקורת שיפוטית"],
      sourceChunkIds: ["chk_1", "unknown", "chk_1"],
    },
    ["chk_1"],
  );
  assert.deepEqual(normalized, {
    title: "Judicial review",
    description: "Courts review a decision.",
    aliases: ["ביקורת שיפוטית"],
    sourceChunkIds: ["chk_1"],
  });
  assert.equal(
    normalizeConceptCandidate(
      { title: "Unsupported", description: "No source", aliases: [], sourceChunkIds: ["unknown"] },
      ["chk_1"],
    ),
    null,
    "uncited concept candidates must not survive normalization",
  );
}

{
  assert.equal(
    findConceptDuplicate(
      {
        title: "הפרדת רשויות",
        aliases: [],
      },
      [existing],
    )?.id,
    "con_existing",
    "an alias collision must be treated as an existing concept duplicate",
  );
}

{
  const reviews = buildReviewCandidates({
    candidates: [
      {
        title: "Separation of powers",
        description: "Duplicate title",
        aliases: [],
        sourceChunkIds: ["chk_1"],
      },
      {
        title: "Judicial review",
        description: "New concept",
        aliases: [],
        sourceChunkIds: ["chk_1"],
      },
      {
        title: "Judicial review",
        description: "Duplicate candidate",
        aliases: [],
        sourceChunkIds: ["chk_1"],
      },
    ],
    origin: "ai_source_chunks",
    sourceLabel: "Lecture",
    allowedSourceChunkIds: ["chk_1"],
    existingConcepts: [existing],
    idPrefix: "eval",
  });
  assert.equal(reviews.length, 2);
  assert.equal(reviews[0].selected, false);
  assert.equal(reviews[0].duplicateOf, "con_existing");
  assert.equal(reviews[1].selected, true);
}

{
  const plan = planConceptCandidateAcceptance({
    candidates: [
      {
        id: "edited_1",
        origin: "ai_source_chunks",
        title: "Judicial review",
        description: "First edited candidate",
        aliases: ["Constitutional control"],
        sourceChunkIds: ["chk_1"],
        selected: true,
      },
      {
        id: "edited_2",
        origin: "ai_source_chunks",
        title: "Constitutional control",
        description: "Second edited candidate",
        aliases: [],
        sourceChunkIds: ["chk_1"],
        selected: true,
      },
      {
        id: "edited_3",
        origin: "ai_source_chunks",
        title: "Judicial oversight",
        description: "Third edited candidate",
        aliases: ["Constitutional control"],
        sourceChunkIds: ["chk_1"],
        selected: true,
      },
    ],
    allowedSourceChunkIds: ["chk_1"],
    existingConcepts: [],
  });
  assert.deepEqual(
    plan.accepted.map((item) => item.candidateId),
    ["edited_1"],
  );
  assert.deepEqual(
    plan.rejected.map((item) => [item.candidateId, item.reason]),
    [
      ["edited_2", "duplicate_batch"],
      ["edited_3", "duplicate_batch"],
    ],
    "manual alias/title edits must be rechecked against the full accepted batch",
  );
}

{
  const plan = planConceptCandidateAcceptance({
    candidates: [
      {
        id: "existing_alias_collision",
        origin: "study_pack_note",
        title: "New label",
        description: "Edited candidate",
        aliases: ["הפרדת רשויות"],
        sourceChunkIds: ["chk_1"],
        selected: true,
      },
      {
        id: "stale_source",
        origin: "study_pack_note",
        title: "Stale source",
        description: "Lost citation",
        aliases: [],
        sourceChunkIds: ["deleted"],
        selected: true,
      },
    ],
    allowedSourceChunkIds: ["chk_1"],
    existingConcepts: [existing],
  });
  assert.deepEqual(
    plan.rejected.map((item) => [item.candidateId, item.reason]),
    [
      ["existing_alias_collision", "duplicate_existing"],
      ["stale_source", "invalid"],
    ],
  );
}

{
  const reviews = extractStudyPackConceptCandidates({
    notes: [
      {
        id: "note_pack",
        title: "Saved Study Pack",
        content:
          "## Ключевые термины\n- **Разделение властей** — дубликат.\n- **Судебный контроль** — новое понятие.",
        tags: ["study-pack"],
        courseId: "crs_1",
        sourceChunkIds: ["chk_1", "deleted_chunk"],
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: "note_regular",
        title: "Regular note",
        content: "## Ключевые термины\n- **Не брать** — обычный конспект.",
        tags: [],
        courseId: "crs_1",
        sourceChunkIds: ["chk_1"],
        createdAt: 1,
        updatedAt: 1,
      },
    ],
    allowedSourceChunkIds: ["chk_1"],
    existingConcepts: [existing],
  });
  assert.equal(reviews.length, 2);
  assert.deepEqual(reviews[0].sourceChunkIds, ["chk_1"]);
  assert.equal(reviews[0].selected, false);
  assert.equal(reviews[1].title, "Судебный контроль");
  assert.equal(
    reviews.some((review) => review.title === "Не брать"),
    false,
  );
}

console.log("Reviewed concept extraction evaluations passed.");
