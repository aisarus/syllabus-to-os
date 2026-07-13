import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckSquare2,
  Clipboard,
  FileText,
  Layers3,
  Pencil,
  Save,
  Scissors,
  Search,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AIGenerateButton } from "@/components/ai-generate-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/lib/app-context";
import {
  countChunkReferences,
  deleteMaterialChunkSafely,
  editMaterialChunk,
  mergeMaterialChunkWithNext,
  moveMaterialChunk,
  splitMaterialChunk,
} from "@/lib/material-chunk-tools";
import {
  getChunksByMaterial,
  store,
  useData,
  type Material,
  type MaterialChunk,
  type MaterialOutputType,
  type MaterialProcessingStatus,
  type MaterialType,
} from "@/lib/store";

type SourceItem = Pick<MaterialChunk, "id" | "title" | "text" | "pageNumber" | "section">;

export function MaterialWorkspace({ material }: { material: Material }) {
  const { t, lang } = useApp();
  const data = useData();
  const navigate = useNavigate();
  const isRu = lang === "ru";
  const chunks = useMemo(
    () => getChunksByMaterial(data, material.id),
    [data.materialChunks, material.id],
  );
  const course = data.courses.find((item) => item.id === material.courseId);
  const topic = data.topics.find((item) => item.id === material.topicId);
  const sourceItems = useMemo<SourceItem[]>(
    () =>
      chunks.length > 0
        ? chunks
        : material.rawText
          ? [
              {
                id: "__raw__",
                title: isRu ? "Полный извлечённый текст" : "Full extracted text",
                text: material.rawText,
              },
            ]
          : [],
    [chunks, material.rawText, isRu],
  );
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(sourceItems.map((item) => item.id)),
  );
  const [activeId, setActiveId] = useState(sourceItems[0]?.id ?? "");
  const [editingChunkId, setEditingChunkId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftText, setDraftText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const validIds = new Set(sourceItems.map((item) => item.id));
    setSelectedIds((current) => {
      const nextValues = [...current].filter((id) => validIds.has(id));
      if (nextValues.length === current.size) return current;
      return new Set(nextValues);
    });
    setActiveId((current) => (validIds.has(current) ? current : (sourceItems[0]?.id ?? "")));
    setEditingChunkId((current) => (current && validIds.has(current) ? current : null));
  }, [sourceItems]);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return sourceItems;
    return sourceItems.filter((item) =>
      [item.title, item.section, item.text].some((value) =>
        value?.toLowerCase().includes(normalized),
      ),
    );
  }, [sourceItems, query]);
  const activeItem = sourceItems.find((item) => item.id === activeId) ?? filteredItems[0];
  const activeChunk = chunks.find((item) => item.id === activeItem?.id);
  const activeChunkIndex = activeChunk
    ? chunks.findIndex((item) => item.id === activeChunk.id)
    : -1;
  const selectedItems = sourceItems.filter((item) => selectedIds.has(item.id));
  const selectedText = selectedItems.map((item) => item.text).join("\n\n");
  const selectedChunkIds = selectedItems.map((item) => item.id).filter((id) => id !== "__raw__");
  const isEditing = Boolean(activeChunk && editingChunkId === activeChunk.id);

  const copySelected = async () => {
    if (!selectedText) return;
    try {
      await navigator.clipboard.writeText(selectedText);
      toast.success(isRu ? "Выбранный текст скопирован" : "Selected text copied");
    } catch {
      toast.error(isRu ? "Не удалось скопировать текст" : "Could not copy text");
    }
  };

  const beginEditing = () => {
    if (!activeChunk) return;
    setEditingChunkId(activeChunk.id);
    setDraftTitle(activeChunk.title ?? "");
    setDraftText(activeChunk.text);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const cancelEditing = () => {
    setEditingChunkId(null);
    setDraftTitle("");
    setDraftText("");
  };

  const saveEditing = () => {
    if (!activeChunk) return;
    if (!draftText.trim()) {
      toast.error(isRu ? "Фрагмент не может быть пустым" : "A chunk cannot be empty");
      return;
    }
    editMaterialChunk(activeChunk.id, { title: draftTitle, text: draftText });
    cancelEditing();
    toast.success(isRu ? "Фрагмент сохранён" : "Chunk saved");
  };

  const splitEditing = () => {
    if (!activeChunk || !textareaRef.current) return;
    const offset = textareaRef.current.selectionStart;
    if (offset <= 0 || offset >= draftText.length) {
      toast.error(
        isRu
          ? "Поставь курсор внутри текста, не в начале и не в конце"
          : "Place the cursor inside the text, not at the beginning or end",
      );
      return;
    }
    if (!draftText.slice(0, offset).trim() || !draftText.slice(offset).trim()) {
      toast.error(isRu ? "Обе части должны содержать текст" : "Both parts must contain text");
      return;
    }

    editMaterialChunk(activeChunk.id, { title: draftTitle, text: draftText });
    const result = splitMaterialChunk(activeChunk.id, offset);
    if (!result) {
      toast.error(isRu ? "Не удалось разделить фрагмент" : "Could not split the chunk");
      return;
    }

    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(result.originalChunkId)) next.add(result.newChunkId);
      return next;
    });
    cancelEditing();
    setActiveId(result.newChunkId);
    toast.success(isRu ? "Фрагмент разделён" : "Chunk split");
  };

  const mergeWithNext = () => {
    if (!activeChunk) return;
    const nextChunk = chunks[activeChunkIndex + 1];
    if (!nextChunk) return;
    const confirmed = confirm(
      isRu
        ? "Объединить этот фрагмент со следующим? Ссылки на оба источника будут сохранены на объединённом фрагменте."
        : "Merge this chunk with the next one? References to both sources will point to the merged chunk.",
    );
    if (!confirmed) return;

    const result = mergeMaterialChunkWithNext(activeChunk.id);
    if (!result) {
      toast.error(isRu ? "Не удалось объединить фрагменты" : "Could not merge chunks");
      return;
    }
    setSelectedIds((current) => {
      const next = new Set(current);
      const wasSelected = next.has(result.keptChunkId) || next.has(result.removedChunkId);
      next.delete(result.removedChunkId);
      if (wasSelected) next.add(result.keptChunkId);
      return next;
    });
    setActiveId(result.keptChunkId);
    toast.success(isRu ? "Фрагменты объединены" : "Chunks merged");
  };

  const moveActiveChunk = (direction: "up" | "down") => {
    if (!activeChunk) return;
    if (!moveMaterialChunk(activeChunk.id, direction)) return;
    toast.success(isRu ? "Порядок обновлён" : "Order updated");
  };

  const deleteActiveChunk = () => {
    if (!activeChunk) return;
    const references = countChunkReferences(data, activeChunk.id);
    const nextActiveId = chunks[activeChunkIndex + 1]?.id ?? chunks[activeChunkIndex - 1]?.id ?? "";
    const warning =
      references.total > 0
        ? isRu
          ? ` На него ссылаются ${references.total} сохранённых элементов; только эта ссылка будет удалена.`
          : ` ${references.total} saved items reference it; only this source link will be removed.`
        : "";
    const confirmed = confirm(
      `${isRu ? "Удалить этот фрагмент?" : "Delete this chunk?"}${warning}`,
    );
    if (!confirmed) return;

    if (!deleteMaterialChunkSafely(activeChunk.id)) {
      toast.error(isRu ? "Не удалось удалить фрагмент" : "Could not delete the chunk");
      return;
    }
    setSelectedIds((current) => {
      const next = new Set(current);
      next.delete(activeChunk.id);
      return next;
    });
    cancelEditing();
    setActiveId(nextActiveId);
    toast.success(isRu ? "Фрагмент удалён" : "Chunk deleted");
  };

  return (
    <div className="mx-auto max-w-[1440px]">
      <div className="mb-3 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        <Link to="/app/materials" className="hover:text-foreground hover:underline">
          {t.materials}
        </Link>
        <span>›</span>
        {course && (
          <>
            <Link
              to="/app/courses/$courseId"
              params={{ courseId: course.id }}
              className="hover:text-foreground hover:underline"
            >
              {course.title}
            </Link>
            <span>›</span>
          </>
        )}
        <span className="max-w-[60vw] truncate text-foreground">{material.title}</span>
      </div>

      <header className="mb-4 flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <Input
            value={material.title}
            aria-label={t.title}
            onChange={(event) => store.updateMaterial(material.id, { title: event.target.value })}
            className="h-auto border-transparent bg-transparent p-0 font-serif text-3xl font-semibold leading-tight hover:border-input focus:border-input md:text-4xl"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className={`rounded px-2 py-1 ${statusClass(material.processingStatus)}`}>
              {statusCopy(material.processingStatus, isRu)}
            </span>
            <span className="rounded border border-border bg-surface px-2 py-1">
              {typeCopy(material.type, isRu)}
            </span>
            {material.sourceLanguage && (
              <span className="rounded border border-border bg-surface px-2 py-1 uppercase text-muted-foreground">
                {material.sourceLanguage}
              </span>
            )}
            {topic && <span className="text-muted-foreground">{topic.title}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate({ to: "/app/materials" })}>
            <ArrowLeft className="h-4 w-4 me-1" />
            {t.back}
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (!confirm(`${t.confirm}?`)) return;
              store.deleteMaterial(material.id);
              navigate({ to: "/app/materials" });
            }}
          >
            <Trash2 className="h-4 w-4 me-1" />
            {t.delete}
          </Button>
        </div>
      </header>

      {material.processingMessage && (
        <div className="mb-4 rounded-md border border-yellow-500/25 bg-yellow-500/5 p-3 text-sm text-yellow-100">
          {material.processingMessage}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        <aside className="min-w-0 rounded-lg border border-border bg-surface">
          <div className="border-b border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">{isRu ? "Источник" : "Source"}</h2>
              <span className="text-xs text-muted-foreground">{sourceItems.length}</span>
            </div>
            <div className="relative mt-3">
              <Search className="absolute start-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={isRu ? "Поиск внутри материала" : "Search inside material"}
                className="ps-8"
              />
            </div>
            <div className="mt-2 flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedIds(new Set(sourceItems.map((item) => item.id)))}
              >
                <CheckSquare2 className="h-3.5 w-3.5 me-1" />
                {isRu ? "Все" : "All"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                <Square className="h-3.5 w-3.5 me-1" />
                {isRu ? "Снять" : "None"}
              </Button>
            </div>
          </div>

          <div className="max-h-[65svh] overflow-y-auto p-2">
            {filteredItems.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">
                {isRu ? "Ничего не найдено" : "Nothing found"}
              </p>
            ) : (
              filteredItems.map((item, index) => {
                const selected = selectedIds.has(item.id);
                const active = activeItem?.id === item.id;
                return (
                  <div
                    key={item.id}
                    className={`mb-1 rounded-md border p-2 transition-colors ${
                      active
                        ? "border-primary/50 bg-primary/5"
                        : "border-transparent hover:border-border"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        className="mt-0.5 text-primary"
                        aria-label={
                          selected
                            ? isRu
                              ? "Снять выбор"
                              : "Deselect"
                            : isRu
                              ? "Выбрать"
                              : "Select"
                        }
                        onClick={() =>
                          setSelectedIds((current) => {
                            const next = new Set(current);
                            if (next.has(item.id)) next.delete(item.id);
                            else next.add(item.id);
                            return next;
                          })
                        }
                      >
                        {selected ? (
                          <CheckSquare2 className="h-4 w-4" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-start"
                        onClick={() => {
                          setActiveId(item.id);
                          if (editingChunkId !== item.id) cancelEditing();
                        }}
                      >
                        <strong className="block truncate text-sm">
                          {item.title ||
                            item.section ||
                            `${isRu ? "Фрагмент" : "Chunk"} ${index + 1}`}
                        </strong>
                        <span className="mt-1 block text-[11px] text-muted-foreground">
                          {sourceMeta(item, isRu)}
                        </span>
                        <span className="mt-1 block line-clamp-2 text-xs text-muted-foreground">
                          {item.text}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        <main className="min-w-0 rounded-lg border border-border bg-surface">
          <div className="flex flex-col gap-3 border-b border-border p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h2 className="truncate font-serif text-xl font-semibold">
                  {activeItem?.title ||
                    activeItem?.section ||
                    (isRu ? "Извлечённый текст" : "Extracted text")}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selectedItems.length} {isRu ? "выбрано" : "selected"} ·{" "}
                  {selectedText.length.toLocaleString()} {isRu ? "знаков" : "characters"}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button variant="outline" size="sm" onClick={copySelected} disabled={!selectedText}>
                  <Clipboard className="h-4 w-4 me-1" />
                  {isRu ? "Копировать" : "Copy"}
                </Button>
                {!isEditing && activeChunk && (
                  <>
                    <Button variant="outline" size="sm" onClick={beginEditing}>
                      <Pencil className="h-4 w-4 me-1" />
                      {isRu ? "Править" : "Edit"}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label={isRu ? "Переместить выше" : "Move up"}
                      onClick={() => moveActiveChunk("up")}
                      disabled={activeChunkIndex <= 0}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label={isRu ? "Переместить ниже" : "Move down"}
                      onClick={() => moveActiveChunk("down")}
                      disabled={activeChunkIndex < 0 || activeChunkIndex >= chunks.length - 1}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={mergeWithNext}
                      disabled={activeChunkIndex < 0 || activeChunkIndex >= chunks.length - 1}
                    >
                      {isRu ? "Объединить со следующим" : "Merge next"}
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      aria-label={isRu ? "Удалить фрагмент" : "Delete chunk"}
                      onClick={deleteActiveChunk}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>

            {activeItem?.id === "__raw__" && (
              <p className="text-xs text-yellow-200">
                {isRu
                  ? "Это запасной полный текст без отдельных чанков. Редактирование появится после создания структуры фрагментов."
                  : "This is the raw-text fallback without editable chunks. Editing becomes available after chunks are created."}
              </p>
            )}
          </div>

          <div className="min-h-[520px] p-5 md:p-7">
            {activeItem ? (
              isEditing ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-muted-foreground">
                      {isRu ? "Название фрагмента" : "Chunk title"}
                    </label>
                    <Input
                      className="mt-1"
                      value={draftTitle}
                      onChange={(event) => setDraftTitle(event.target.value)}
                      placeholder={isRu ? "Необязательно" : "Optional"}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">
                      {isRu ? "Текст" : "Text"}
                    </label>
                    <Textarea
                      ref={textareaRef}
                      dir="auto"
                      className="mt-1 min-h-[360px] resize-y text-[15px] leading-7"
                      value={draftText}
                      onChange={(event) => setDraftText(event.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-muted-foreground">
                      {isRu
                        ? "Для разделения поставь курсор в нужное место текста."
                        : "To split, place the cursor at the desired point in the text."}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={splitEditing}>
                        <Scissors className="h-4 w-4 me-1" />
                        {isRu ? "Разделить здесь" : "Split here"}
                      </Button>
                      <Button variant="ghost" onClick={cancelEditing}>
                        <X className="h-4 w-4 me-1" />
                        {isRu ? "Отмена" : "Cancel"}
                      </Button>
                      <Button onClick={saveEditing}>
                        <Save className="h-4 w-4 me-1" />
                        {isRu ? "Сохранить" : "Save"}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <article
                  dir="auto"
                  className="whitespace-pre-wrap text-[15px] leading-7 text-foreground"
                >
                  {activeItem.text}
                </article>
              )
            ) : (
              <div className="flex min-h-[420px] items-center justify-center text-center text-muted-foreground">
                <div>
                  <FileText className="mx-auto mb-3 h-8 w-8" />
                  <p>
                    {isRu
                      ? "В материале пока нет извлечённого текста"
                      : "This material has no extracted text yet"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </main>

        <aside className="space-y-4">
          <section className="rounded-lg border border-border bg-surface p-4">
            <h2 className="font-semibold">
              {isRu ? "Создать из выбранного" : "Create from selection"}
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {isRu
                ? "AI получит только выбранные фрагменты и сохранит связь с источником."
                : "AI receives only selected chunks and keeps source relationships."}
            </p>
            <div className="mt-3 grid gap-2">
              <AIGenerateButton
                kind="note"
                initialMaterialId={material.id}
                initialCourseId={material.courseId}
                initialTopicId={material.topicId}
                initialChunkIds={selectedChunkIds}
                label={isRu ? "Создать конспект" : "Create note"}
              />
              <AIGenerateButton
                kind="flashcards"
                initialMaterialId={material.id}
                initialCourseId={material.courseId}
                initialTopicId={material.topicId}
                initialChunkIds={selectedChunkIds}
                label={isRu ? "Создать карточки" : "Create flashcards"}
              />
              <AIGenerateButton
                kind="quiz"
                initialMaterialId={material.id}
                initialCourseId={material.courseId}
                initialTopicId={material.topicId}
                initialChunkIds={selectedChunkIds}
                label={isRu ? "Создать тест" : "Create quiz"}
              />
            </div>
            {!selectedText && (
              <p className="mt-2 text-xs text-yellow-200">
                {isRu
                  ? "Сначала выбери хотя бы один фрагмент."
                  : "Select at least one source section first."}
              </p>
            )}
          </section>

          <MetadataPanel material={material} />
          <OutputsPanel material={material} />
        </aside>
      </div>
    </div>
  );
}

function MetadataPanel({ material }: { material: Material }) {
  const { lang } = useApp();
  const data = useData();
  const isRu = lang === "ru";
  const topics = data.topics.filter(
    (topic) => !material.courseId || topic.courseId === material.courseId,
  );

  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h2 className="font-semibold">{isRu ? "Метаданные" : "Metadata"}</h2>
      <div className="mt-3 space-y-3">
        <div>
          <label className="text-xs text-muted-foreground">{isRu ? "Тип" : "Type"}</label>
          <Select
            value={material.type}
            onValueChange={(value) =>
              store.updateMaterial(material.id, { type: value as MaterialType })
            }
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(
                [
                  "syllabus",
                  "lecture",
                  "article",
                  "assignment",
                  "presentation",
                  "exam",
                  "other",
                ] as const
              ).map((value) => (
                <SelectItem key={value} value={value}>
                  {typeCopy(value, isRu)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs text-muted-foreground">{isRu ? "Курс" : "Course"}</label>
          <Select
            value={material.courseId ?? "_none"}
            onValueChange={(value) =>
              store.updateMaterial(material.id, {
                courseId: value === "_none" ? undefined : value,
                topicId: undefined,
              })
            }
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">— {isRu ? "Без курса" : "No course"} —</SelectItem>
              {data.courses.map((course) => (
                <SelectItem key={course.id} value={course.id}>
                  {course.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs text-muted-foreground">{isRu ? "Тема" : "Topic"}</label>
          <Select
            value={material.topicId ?? "_none"}
            onValueChange={(value) =>
              store.updateMaterial(material.id, {
                topicId: value === "_none" ? undefined : value,
              })
            }
            disabled={!material.courseId}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">— {isRu ? "Без темы" : "No topic"} —</SelectItem>
              {topics.map((topic) => (
                <SelectItem key={topic.id} value={topic.id}>
                  {topic.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs text-muted-foreground">{isRu ? "Теги" : "Tags"}</label>
          <Input
            className="mt-1"
            value={material.tags.join(", ")}
            onChange={(event) =>
              store.updateMaterial(material.id, {
                tags: event.target.value
                  .split(",")
                  .map((tag) => tag.trim())
                  .filter(Boolean),
              })
            }
          />
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t border-border pt-3 text-xs">
          <dt className="text-muted-foreground">{isRu ? "Слов" : "Words"}</dt>
          <dd>{material.wordCount ?? 0}</dd>
          <dt className="text-muted-foreground">{isRu ? "Страниц" : "Pages"}</dt>
          <dd>{material.pageCount ?? "—"}</dd>
          <dt className="text-muted-foreground">{isRu ? "Метод" : "Method"}</dt>
          <dd>{material.extractionMethod ?? "—"}</dd>
          <dt className="text-muted-foreground">{isRu ? "Файл" : "File"}</dt>
          <dd className="truncate" title={material.fileName}>
            {material.fileName ?? "—"}
          </dd>
        </dl>
      </div>
    </section>
  );
}

function OutputsPanel({ material }: { material: Material }) {
  const { lang } = useApp();
  const data = useData();
  const isRu = lang === "ru";
  const notes = data.notes.filter((item) => item.materialId === material.id);
  const cards = data.flashcards.filter((item) => item.materialId === material.id);
  const quizzes = data.quizzes.filter((item) => item.materialId === material.id);
  const outlines = data.presentationOutlines.filter((item) => item.materialId === material.id);
  const history = data.materialOutputs
    .filter((item) => item.materialId === material.id)
    .sort((a, b) => b.createdAt - a.createdAt);

  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">{isRu ? "Создано из материала" : "Created from material"}</h2>
        <Layers3 className="h-4 w-4 text-primary" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <OutputCount to="/app/notes" label={isRu ? "Конспекты" : "Notes"} count={notes.length} />
        <OutputCount
          to="/app/flashcards"
          label={isRu ? "Карточки" : "Cards"}
          count={cards.length}
        />
        <OutputCount to="/app/quizzes" label={isRu ? "Тесты" : "Quizzes"} count={quizzes.length} />
        <OutputCount
          to="/app/presentations"
          label={isRu ? "Планы" : "Outlines"}
          count={outlines.length}
        />
      </div>

      {quizzes.length > 0 && (
        <div className="mt-3 space-y-1 border-t border-border pt-3">
          {quizzes.slice(0, 3).map((quiz) => (
            <Link
              key={quiz.id}
              to="/app/quizzes/$quizId"
              params={{ quizId: quiz.id }}
              className="block truncate text-xs text-primary hover:underline"
            >
              {quiz.title}
            </Link>
          ))}
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-3 border-t border-border pt-3">
          <h3 className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {isRu ? "История генераций" : "Generation history"}
          </h3>
          <div className="mt-2 space-y-2">
            {history.slice(0, 6).map((output) => (
              <div key={output.id} className="flex items-center justify-between gap-2 text-xs">
                <span>{outputTypeCopy(output.type, isRu)}</span>
                <time className="text-[10px] text-muted-foreground">
                  {new Date(output.createdAt).toLocaleDateString(isRu ? "ru-RU" : "en-GB")}
                </time>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function OutputCount({ to, label, count }: { to: string; label: string; count: number }) {
  return (
    <Link
      to={to as never}
      className="rounded-md border border-border bg-background p-2 hover:bg-accent"
    >
      <span className="block text-lg font-semibold">{count}</span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </Link>
  );
}

function sourceMeta(item: SourceItem, isRu: boolean): string {
  const parts = [
    item.pageNumber ? `${isRu ? "стр." : "p."} ${item.pageNumber}` : undefined,
    item.section,
    `${item.text.length.toLocaleString()} ${isRu ? "зн." : "chars"}`,
  ].filter(Boolean);
  return parts.join(" · ");
}

function statusClass(status: MaterialProcessingStatus): string {
  const map: Record<MaterialProcessingStatus, string> = {
    ready: "bg-emerald-500/15 text-emerald-300",
    partial: "bg-sky-500/15 text-sky-300",
    unsupported: "bg-yellow-500/15 text-yellow-300",
    no_text: "bg-orange-500/15 text-orange-300",
    error: "bg-red-500/15 text-red-300",
  };
  return map[status];
}

function statusCopy(status: MaterialProcessingStatus, isRu: boolean): string {
  const map: Record<MaterialProcessingStatus, [string, string]> = {
    ready: ["Готов", "Ready"],
    partial: ["Частично", "Partial"],
    unsupported: ["Не поддерживается", "Unsupported"],
    no_text: ["Нет текста", "No text"],
    error: ["Ошибка", "Error"],
  };
  return map[status][isRu ? 0 : 1];
}

function typeCopy(type: MaterialType, isRu: boolean): string {
  const map: Record<MaterialType, [string, string]> = {
    syllabus: ["Силлабус", "Syllabus"],
    lecture: ["Лекция", "Lecture"],
    article: ["Статья", "Article"],
    assignment: ["Задание", "Assignment"],
    presentation: ["Презентация", "Presentation"],
    exam: ["Экзамен", "Exam"],
    other: ["Другое", "Other"],
  };
  return map[type][isRu ? 0 : 1];
}

function outputTypeCopy(type: MaterialOutputType, isRu: boolean): string {
  const map: Record<MaterialOutputType, [string, string]> = {
    note: ["Конспект", "Note"],
    quiz: ["Тест", "Quiz"],
    flashcards: ["Карточки", "Flashcards"],
    outline: ["План", "Outline"],
    presentation_outline: ["План презентации", "Presentation outline"],
    task_list: ["Список задач", "Task list"],
  };
  return map[type][isRu ? 0 : 1];
}
