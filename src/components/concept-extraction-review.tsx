import {
  AlertTriangle,
  Bot,
  Check,
  FileText,
  Loader2,
  ScanSearch,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/lib/app-context";
import {
  buildReviewCandidates,
  extractStudyPackConceptCandidates,
  findConceptDuplicate,
  normalizeConceptCandidate,
  type ConceptCandidateReview,
} from "@/lib/concept-extraction";
import { generateConceptCandidatesDraft } from "@/lib/concept-extraction-client";
import { conceptStore, useConceptEvidenceData } from "@/lib/concept-store";
import { useData } from "@/lib/store";

const MAX_SELECTED_CHUNKS = 8;

export function ConceptExtractionReview({ courseId }: { courseId: string }) {
  const { lang } = useApp();
  const isRu = lang === "ru";
  const core = useData();
  const conceptData = useConceptEvidenceData();
  const course = core.courses.find((item) => item.id === courseId);
  const topics = core.topics.filter((item) => item.courseId === courseId);
  const materials = core.materials.filter((item) => item.courseId === courseId);
  const materialIds = new Set(materials.map((item) => item.id));
  const courseChunks = core.materialChunks.filter((item) => materialIds.has(item.materialId));
  const courseNotes = core.notes.filter((item) => item.courseId === courseId);
  const existingConcepts = conceptData.concepts.filter((item) => item.courseId === courseId);
  const [materialId, setMaterialId] = useState(materials[0]?.id ?? "");
  const [selectedChunkIds, setSelectedChunkIds] = useState<string[]>([]);
  const [targetTopicId, setTargetTopicId] = useState("_none");
  const [instructions, setInstructions] = useState("");
  const [candidates, setCandidates] = useState<ConceptCandidateReview[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [trustLabel, setTrustLabel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const materialChunks = useMemo(
    () => core.materialChunks.filter((chunk) => chunk.materialId === materialId),
    [core.materialChunks, materialId],
  );

  useEffect(() => {
    if (!materialId && materials[0]) setMaterialId(materials[0].id);
  }, [materialId, materials]);

  useEffect(() => {
    setSelectedChunkIds(materialChunks.slice(0, MAX_SELECTED_CHUNKS).map((chunk) => chunk.id));
  }, [materialId, materialChunks.length]);

  const selectedChunks = materialChunks.filter((chunk) => selectedChunkIds.includes(chunk.id));
  const materialById = new Map(materials.map((item) => [item.id, item]));
  const chunkById = new Map(courseChunks.map((item) => [item.id, item]));
  const studyPackNotes = courseNotes.filter((note) => note.tags.includes("study-pack"));

  const toggleChunk = (id: string) => {
    setSelectedChunkIds((current) => {
      if (current.includes(id)) return current.filter((value) => value !== id);
      if (current.length >= MAX_SELECTED_CHUNKS) {
        toast.info(
          isRu
            ? `За один запрос можно выбрать максимум ${MAX_SELECTED_CHUNKS} фрагментов.`
            : `Select at most ${MAX_SELECTED_CHUNKS} chunks per request.`,
        );
        return current;
      }
      return [...current, id];
    });
  };

  const extractFromAI = async () => {
    const material = materials.find((item) => item.id === materialId);
    if (!material || selectedChunks.length === 0) {
      toast.error(isRu ? "Выбери материал и фрагменты" : "Select a material and source chunks");
      return;
    }
    setBusy(true);
    setWarnings([]);
    setTrustLabel(null);
    try {
      const result = await generateConceptCandidatesDraft({
        locale: isRu ? "ru" : "en",
        targetLanguage: isRu ? "ru" : "en",
        course: course
          ? { id: course.id, title: course.title, number: course.number }
          : { id: courseId },
        material: { id: material.id, title: material.title, type: material.type },
        chunks: selectedChunks.map((chunk) => ({
          id: chunk.id,
          title: chunk.title,
          text: chunk.text,
          pageNumber: chunk.pageNumber,
          section: chunk.section,
        })),
        existingConceptTitles: existingConcepts.flatMap((concept) => [
          concept.title,
          ...concept.aliases,
        ]),
        instructions: instructions.trim() || undefined,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      const reviews = buildReviewCandidates({
        candidates: result.data.candidates,
        origin: "ai_source_chunks",
        sourceLabel: material.title,
        allowedSourceChunkIds: selectedChunkIds,
        existingConcepts,
        idPrefix: `ai-${material.id}`,
      });
      setCandidates(reviews);
      setWarnings(result.data.warnings ?? []);
      setTrustLabel(
        result.data.trust
          ? `${result.data.trust.model} · ${result.data.trust.promptVersion}`
          : null,
      );
      toast.success(
        isRu
          ? `Кандидатов на проверку: ${reviews.length}`
          : `${reviews.length} candidates are ready for review`,
      );
    } finally {
      setBusy(false);
    }
  };

  const extractFromStudyPacks = () => {
    const reviews = extractStudyPackConceptCandidates({
      notes: studyPackNotes,
      allowedSourceChunkIds: courseChunks.map((chunk) => chunk.id),
      existingConcepts,
    });
    setCandidates(reviews);
    setWarnings(
      reviews.length === 0
        ? [
            isRu
              ? "В сохранённых Study Pack не найден раздел «Ключевые термины» с действующими sourceChunkIds."
              : "No saved Study Pack contains a Key terms section with current sourceChunkIds.",
          ]
        : [
            isRu
              ? "Study Pack хранит ссылки на уровне всего конспекта, поэтому каждую связь нужно проверить вручную."
              : "Saved Study Packs retain note-level citations, so every proposed link still needs manual review.",
          ],
    );
    setTrustLabel(isRu ? "Локальный разбор сохранённых Study Pack" : "Local saved Study Pack parser");
  };

  const updateCandidate = (id: string, patch: Partial<ConceptCandidateReview>) => {
    setCandidates((current) =>
      current.map((candidate) => (candidate.id === id ? { ...candidate, ...patch } : candidate)),
    );
  };

  const acceptSelected = () => {
    const allowed = new Set(courseChunks.map((chunk) => chunk.id));
    const acceptedTitles = new Set<string>();
    let accepted = 0;
    let skipped = 0;
    for (const candidate of candidates.filter((item) => item.selected)) {
      const normalized = normalizeConceptCandidate(candidate, allowed);
      const duplicate = normalized
        ? findConceptDuplicate(normalized, [
            ...existingConcepts,
            ...Array.from(acceptedTitles).map((title, index) => ({
              id: `accepted-${index}`,
              courseId,
              title,
              aliases: [],
              sourceChunkIds: [],
              flashcardIds: [],
              quizQuestionIds: [],
              createdAt: 0,
              updatedAt: 0,
            })),
          ])
        : undefined;
      if (!normalized || duplicate) {
        skipped += 1;
        continue;
      }
      const created = conceptStore.createConcept({
        courseId,
        topicId: targetTopicId === "_none" ? undefined : targetTopicId,
        title: normalized.title,
        description: normalized.description,
        aliases: normalized.aliases,
      });
      conceptStore.updateConcept(created.id, {
        sourceChunkIds: normalized.sourceChunkIds,
      });
      acceptedTitles.add(normalized.title);
      accepted += 1;
    }
    setCandidates((current) => current.filter((candidate) => !candidate.selected));
    toast.success(
      isRu
        ? `Добавлено понятий: ${accepted}${skipped ? `, пропущено: ${skipped}` : ""}`
        : `Added ${accepted} concepts${skipped ? `; skipped ${skipped}` : ""}`,
    );
  };

  return (
    <section className="mx-auto mt-5 max-w-[1440px] rounded-xl border border-border bg-surface p-4 md:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-primary">
            <ScanSearch className="h-4 w-4" />
            {isRu ? "Извлечение понятий" : "Concept extraction"}
          </div>
          <h2 className="mt-2 font-serif text-2xl font-semibold">
            {isRu ? "Сначала кандидаты, потом решение человека" : "Candidates first, human decision second"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {isRu
              ? "ИИ и Study Pack могут только предложить понятия. Ничего не добавляется в карту знаний до твоего подтверждения; принятие кандидата не создаёт learning evidence и не повышает состояние знания."
              : "AI and Study Packs can only propose concepts. Nothing enters the knowledge map until you approve it; accepting a candidate creates no learning evidence and raises no knowledge state."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={extractFromStudyPacks}
            disabled={studyPackNotes.length === 0 || busy}
          >
            <FileText className="h-4 w-4 me-1" />
            {isRu ? `Из Study Pack (${studyPackNotes.length})` : `From Study Packs (${studyPackNotes.length})`}
          </Button>
          <Button onClick={() => void extractFromAI()} disabled={busy || selectedChunks.length === 0}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <Sparkles className="h-4 w-4 me-1" />}
            {isRu ? "Предложить из источников" : "Propose from sources"}
          </Button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-lg border border-border bg-background p-4">
          <label className="text-xs text-muted-foreground">{isRu ? "Материал" : "Material"}</label>
          <select
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={materialId}
            onChange={(event) => setMaterialId(event.target.value)}
          >
            {materials.length === 0 && <option value="">{isRu ? "Нет материалов" : "No materials"}</option>}
            {materials.map((material) => (
              <option key={material.id} value={material.id}>
                {material.title}
              </option>
            ))}
          </select>

          <div className="mt-4 flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{isRu ? "Подтверждённые фрагменты" : "Approved chunks"}</span>
            <span className="font-mono text-[10px] text-muted-foreground">
              {selectedChunkIds.length}/{MAX_SELECTED_CHUNKS}
            </span>
          </div>
          <div className="mt-2 max-h-72 space-y-2 overflow-auto pe-1">
            {materialChunks.map((chunk) => (
              <label key={chunk.id} className="flex cursor-pointer gap-2 rounded-md border border-border p-2 text-xs">
                <input
                  type="checkbox"
                  checked={selectedChunkIds.includes(chunk.id)}
                  onChange={() => toggleChunk(chunk.id)}
                />
                <span className="min-w-0">
                  <strong className="block truncate">{chunk.title || chunk.section || chunk.id}</strong>
                  <span className="mt-1 line-clamp-2 text-muted-foreground">
                    {chunk.pageNumber ? `p.${chunk.pageNumber} · ` : ""}{chunk.text}
                  </span>
                </span>
              </label>
            ))}
            {materialChunks.length === 0 && (
              <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                {isRu ? "У материала нет применённых фрагментов." : "This material has no applied chunks."}
              </p>
            )}
          </div>
          <label className="mt-4 block text-xs text-muted-foreground">
            {isRu ? "Дополнительное указание (не источник фактов)" : "Optional instruction (not a factual source)"}
          </label>
          <Textarea
            className="mt-1 min-h-20"
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            placeholder={isRu ? "Например: выделяй юридические доктрины" : "For example: focus on legal doctrines"}
          />
        </aside>

        <div className="min-w-0">
          {trustLabel && (
            <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Bot className="h-4 w-4" />
              {trustLabel}
            </div>
          )}
          {warnings.length > 0 && (
            <div className="mb-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3 text-xs text-yellow-100">
              {warnings.map((warning) => <p key={warning}>• {warning}</p>)}
            </div>
          )}

          {candidates.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <ScanSearch className="mx-auto h-9 w-9 text-muted-foreground" />
              <strong className="mt-3 block">{isRu ? "Кандидатов пока нет" : "No candidates yet"}</strong>
              <p className="mx-auto mt-1 max-w-xl text-sm text-muted-foreground">
                {isRu
                  ? "Выбери до восьми фрагментов для ИИ или разбери уже сохранённые Study Pack. Результат всегда открывается как редактируемый черновик."
                  : "Select up to eight chunks for AI or scan saved Study Packs. Results always open as an editable draft."}
              </p>
            </div>
          ) : (
            <>
              <div className="mb-3 flex flex-col gap-3 rounded-lg border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <strong className="text-sm">{isRu ? "Проверка перед добавлением" : "Review before adding"}</strong>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {isRu ? "Проверь формулировку и каждую source-связь." : "Verify the wording and every source relationship."}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="h-9 rounded-md border border-input bg-background px-3 text-xs"
                    value={targetTopicId}
                    onChange={(event) => setTargetTopicId(event.target.value)}
                  >
                    <option value="_none">{isRu ? "Без темы" : "No topic"}</option>
                    {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}
                  </select>
                  <Button
                    onClick={acceptSelected}
                    disabled={!candidates.some((candidate) => candidate.selected)}
                  >
                    <Check className="h-4 w-4 me-1" />
                    {isRu ? "Добавить выбранные" : "Add selected"}
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {candidates.map((candidate) => {
                  const duplicate = findConceptDuplicate(candidate, existingConcepts);
                  return (
                    <article key={candidate.id} className="rounded-lg border border-border bg-background p-4">
                      <div className="flex items-start gap-3">
                        <input
                          className="mt-3"
                          type="checkbox"
                          checked={candidate.selected && !duplicate}
                          disabled={Boolean(duplicate)}
                          onChange={(event) => updateCandidate(candidate.id, { selected: event.target.checked })}
                        />
                        <div className="min-w-0 flex-1 space-y-3">
                          <div className="grid gap-3 md:grid-cols-2">
                            <div>
                              <label className="text-xs text-muted-foreground">{isRu ? "Название" : "Title"}</label>
                              <Input value={candidate.title} onChange={(event) => updateCandidate(candidate.id, { title: event.target.value })} />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">{isRu ? "Алиасы через запятую" : "Aliases, comma-separated"}</label>
                              <Input
                                value={candidate.aliases.join(", ")}
                                onChange={(event) => updateCandidate(candidate.id, {
                                  aliases: event.target.value.split(",").map((value) => value.trim()).filter(Boolean),
                                })}
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">{isRu ? "Описание" : "Description"}</label>
                            <Textarea
                              className="mt-1 min-h-20"
                              value={candidate.description}
                              onChange={(event) => updateCandidate(candidate.id, { description: event.target.value })}
                            />
                          </div>
                          {duplicate && (
                            <div className="flex items-center gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/5 p-2 text-xs text-yellow-100">
                              <AlertTriangle className="h-4 w-4 shrink-0" />
                              {isRu ? `Дубликат существующего понятия: ${duplicate.title}` : `Duplicates existing concept: ${duplicate.title}`}
                            </div>
                          )}
                          <div className="flex flex-wrap gap-2">
                            {candidate.sourceChunkIds.map((chunkId) => {
                              const chunk = chunkById.get(chunkId);
                              const material = chunk ? materialById.get(chunk.materialId) : undefined;
                              return (
                                <label key={chunkId} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-[10px] text-muted-foreground">
                                  <input
                                    type="checkbox"
                                    checked
                                    onChange={() => updateCandidate(candidate.id, {
                                      sourceChunkIds: candidate.sourceChunkIds.filter((id) => id !== chunkId),
                                    })}
                                  />
                                  {material?.title ?? chunkId}{chunk?.pageNumber ? ` · p.${chunk.pageNumber}` : ""}
                                </label>
                              );
                            })}
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            {candidate.origin === "ai_source_chunks"
                              ? isRu ? "Источник кандидата: выбранные чанки через ИИ" : "Candidate origin: AI over selected chunks"
                              : `${isRu ? "Источник кандидата" : "Candidate origin"}: ${candidate.sourceLabel ?? "Study Pack"}`}
                          </p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setCandidates((current) => current.filter((item) => item.id !== candidate.id))}
                          aria-label={isRu ? "Удалить кандидата" : "Remove candidate"}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
