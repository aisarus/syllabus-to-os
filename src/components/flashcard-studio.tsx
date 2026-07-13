import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  CheckSquare2,
  CopyCheck,
  Download,
  ExternalLink,
  FileUp,
  GitMerge,
  Layers3,
  Play,
  Plus,
  Search,
  Square,
  Trash2,
  Upload,
} from "lucide-react";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AIGenerateButton } from "@/components/ai-generate-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  store,
  useData,
  type CardStatus,
  type Flashcard,
  type Material,
  type Topic,
} from "@/lib/store";

interface DuplicateGroup {
  id: string;
  kind: "exact" | "likely";
  cardIds: string[];
  confidence: number;
}

interface ImportedCardRow {
  front: string;
  back: string;
  courseId?: string;
  topicId?: string;
  materialId?: string;
  sourceChunkIds: string[];
  valid: boolean;
  warning?: string;
}

export function FlashcardStudio() {
  const { lang } = useApp();
  const isRu = lang === "ru";
  const data = useData();
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const [topicFilter, setTopicFilter] = useState("all");
  const [materialFilter, setMaterialFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkRelinkOpen, setBulkRelinkOpen] = useState(false);
  const [duplicateGroup, setDuplicateGroup] = useState<DuplicateGroup | null>(null);
  const [importRows, setImportRows] = useState<ImportedCardRow[] | null>(null);

  const topicsForFilter = data.topics.filter(
    (topic) => courseFilter === "all" || topic.courseId === courseFilter,
  );
  const materialsForFilter = data.materials.filter(
    (material) =>
      courseFilter === "all" || !material.courseId || material.courseId === courseFilter,
  );

  const filtered = useMemo(() => {
    const query = normalizeText(search);
    return data.flashcards
      .filter((card) => courseFilter === "all" || card.courseId === courseFilter)
      .filter((card) => topicFilter === "all" || card.topicId === topicFilter)
      .filter((card) => materialFilter === "all" || card.materialId === materialFilter)
      .filter((card) => statusFilter === "all" || card.status === statusFilter)
      .filter(
        (card) =>
          !query ||
          normalizeText(card.front).includes(query) ||
          normalizeText(card.back).includes(query),
      )
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [data.flashcards, search, courseFilter, topicFilter, materialFilter, statusFilter]);

  const duplicateGroups = useMemo(() => detectDuplicateGroups(data.flashcards), [data.flashcards]);
  const dueCards = useMemo(
    () => data.flashcards.filter((card) => card.dueAt <= Date.now()),
    [data.flashcards],
  );
  const selectedCards = selectedIds
    .map((id) => data.flashcards.find((card) => card.id === id))
    .filter((card): card is Flashcard => Boolean(card));
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((card) => selectedIds.includes(card.id));

  const resetDependentFilters = (courseId: string) => {
    setCourseFilter(courseId);
    setTopicFilter("all");
    setMaterialFilter("all");
  };

  const exportCards = () => {
    const cards = selectedCards.length > 0 ? selectedCards : filtered;
    if (cards.length === 0) return;
    const header = ["front", "back", "courseId", "topicId", "materialId", "sourceChunkIds"];
    const rows = cards.map((card) => [
      card.front,
      card.back,
      card.courseId ?? "",
      card.topicId ?? "",
      card.materialId ?? "",
      (card.sourceChunkIds ?? []).join("|"),
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n");
    downloadFile("lamdan-flashcards.csv", csv, "text/csv;charset=utf-8");
  };

  const loadCsv = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (parsed.length < 2) throw new Error(isRu ? "CSV пустой" : "CSV is empty");
      const [header, ...rows] = parsed;
      const index = Object.fromEntries(header.map((value, i) => [value.trim(), i]));
      if (index.front == null || index.back == null) {
        throw new Error(isRu ? "Нужны колонки front и back" : "CSV needs front and back columns");
      }
      const imported = rows
        .filter((row) => row.some((cell) => cell.trim()))
        .map((row) => validateImportedRow(row, index, data));
      setImportRows(imported);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div className="mx-auto max-w-[1440px]">
      <header className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold">
            {isRu ? "Студия карточек" : "Flashcard Studio"}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {isRu
              ? "Редактируй большие наборы прямо в списке, перепривязывай их пачками и разбирай дубликаты до режима повторения."
              : "Curate large generated sets inline, relink them in bulk, and resolve duplicates before review mode."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AIGenerateButton kind="flashcards" />
          <Button
            variant="outline"
            onClick={() => setReviewOpen(true)}
            disabled={dueCards.length === 0}
            title={
              dueCards.length === 0
                ? isRu
                  ? "Сейчас нет карточек к повторению"
                  : "No cards are due right now"
                : undefined
            }
          >
            <Play className="h-4 w-4 me-1" />
            {isRu ? "Повторение" : "Review"} ({dueCards.length})
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 me-1" />
                {isRu ? "Новая карточка" : "New card"}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{isRu ? "Создать карточку" : "Create flashcard"}</DialogTitle>
              </DialogHeader>
              <CreateCardForm onDone={() => setCreateOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <section className="mt-5 rounded-xl border border-border bg-surface p-4">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_210px_210px_210px_160px]">
          <div className="relative">
            <Search className="absolute start-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="ps-8"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={isRu ? "Поиск по вопросу и ответу" : "Search front and back"}
            />
          </div>
          <Select value={courseFilter} onValueChange={resetDependentFilters}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isRu ? "Все курсы" : "All courses"}</SelectItem>
              <SelectItem value="_none">{isRu ? "Без курса" : "No course"}</SelectItem>
              {data.courses.map((course) => (
                <SelectItem key={course.id} value={course.id}>
                  {course.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={topicFilter} onValueChange={setTopicFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isRu ? "Все темы" : "All topics"}</SelectItem>
              <SelectItem value="_none">{isRu ? "Без темы" : "No topic"}</SelectItem>
              {topicsForFilter.map((topic) => (
                <SelectItem key={topic.id} value={topic.id}>
                  {topic.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={materialFilter} onValueChange={setMaterialFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isRu ? "Все материалы" : "All materials"}</SelectItem>
              <SelectItem value="_none">{isRu ? "Без материала" : "No material"}</SelectItem>
              {materialsForFilter.map((material) => (
                <SelectItem key={material.id} value={material.id}>
                  {material.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isRu ? "Все статусы" : "All statuses"}</SelectItem>
              <SelectItem value="new">{isRu ? "Новые" : "New"}</SelectItem>
              <SelectItem value="learning">{isRu ? "В изучении" : "Learning"}</SelectItem>
              <SelectItem value="mastered">{isRu ? "Освоенные" : "Mastered"}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>
              {filtered.length} {isRu ? "карточек в выборке" : "cards in view"}
            </span>
            <span>·</span>
            <span>
              {selectedCards.length} {isRu ? "выбрано" : "selected"}
            </span>
            {duplicateGroups.length > 0 && (
              <>
                <span>·</span>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-yellow-200 hover:underline"
                  onClick={() =>
                    document
                      .getElementById("duplicate-review")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {duplicateGroups.length} {isRu ? "групп дубликатов" : "duplicate groups"}
                </button>
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                const visibleIds = filtered.map((card) => card.id);
                setSelectedIds((current) =>
                  allFilteredSelected
                    ? current.filter((id) => !visibleIds.includes(id))
                    : Array.from(new Set([...current, ...visibleIds])),
                );
              }}
              disabled={filtered.length === 0}
            >
              {allFilteredSelected ? (
                <Square className="h-3.5 w-3.5 me-1" />
              ) : (
                <CheckSquare2 className="h-3.5 w-3.5 me-1" />
              )}
              {allFilteredSelected
                ? isRu
                  ? "Снять видимые"
                  : "Deselect visible"
                : isRu
                  ? "Выбрать видимые"
                  : "Select visible"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={selectedCards.length === 0}
              onClick={() => setBulkRelinkOpen(true)}
            >
              <Layers3 className="h-3.5 w-3.5 me-1" />
              {isRu ? "Перепривязать" : "Relink"}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={selectedCards.length === 0}
              onClick={() => setBulkDeleteOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5 me-1" />
              {isRu ? "Удалить выбранные" : "Delete selected"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={exportCards}
              disabled={filtered.length === 0 && selectedCards.length === 0}
            >
              <Download className="h-3.5 w-3.5 me-1" />
              CSV
            </Button>
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void loadCsv(file);
              }}
            />
            <Button size="sm" variant="outline" onClick={() => csvInputRef.current?.click()}>
              <Upload className="h-3.5 w-3.5 me-1" />
              {isRu ? "Импорт CSV" : "Import CSV"}
            </Button>
          </div>
        </div>
      </section>

      {filtered.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-border p-12 text-center">
          <Layers3 className="mx-auto h-8 w-8 text-muted-foreground" />
          <strong className="mt-3 block">
            {data.flashcards.length === 0
              ? isRu
                ? "Карточек пока нет"
                : "No flashcards yet"
              : isRu
                ? "По фильтрам ничего не найдено"
                : "No cards match the filters"}
          </strong>
          <p className="mt-1 text-sm text-muted-foreground">
            {isRu
              ? "Создай карточку вручную, сгенерируй набор из материала или измени фильтры."
              : "Create one manually, generate a set from source material, or change the filters."}
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {filtered.map((card) => (
            <FlashcardRow
              key={card.id}
              card={card}
              selected={selectedIds.includes(card.id)}
              onSelectedChange={(selected) =>
                setSelectedIds((current) =>
                  selected
                    ? Array.from(new Set([...current, card.id]))
                    : current.filter((id) => id !== card.id),
                )
              }
            />
          ))}
        </div>
      )}

      <section
        id="duplicate-review"
        className="mt-6 rounded-xl border border-border bg-surface p-4 md:p-5"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-serif text-xl font-semibold">
              {isRu ? "Проверка дубликатов" : "Duplicate review"}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {isRu
                ? "Точные совпадения и вероятно одинаковые карточки. Ничего не удаляется без отдельного подтверждения."
                : "Exact matches and likely duplicates. Nothing is removed without a separate confirmation."}
            </p>
          </div>
          <span className="rounded border border-border bg-background px-2 py-1 text-xs text-muted-foreground">
            {duplicateGroups.length}
          </span>
        </div>
        {duplicateGroups.length === 0 ? (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-200">
            <CopyCheck className="mt-0.5 h-4 w-4" />
            {isRu ? "Похожих карточек не найдено." : "No duplicate groups detected."}
          </div>
        ) : (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {duplicateGroups.map((group) => {
              const cards = group.cardIds
                .map((id) => data.flashcards.find((card) => card.id === id))
                .filter((card): card is Flashcard => Boolean(card));
              return (
                <article
                  key={group.id}
                  className="rounded-lg border border-border bg-background p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`rounded px-2 py-1 text-[10px] uppercase ${group.kind === "exact" ? "bg-red-500/10 text-red-200" : "bg-yellow-500/10 text-yellow-200"}`}
                    >
                      {group.kind === "exact"
                        ? isRu
                          ? "Точные"
                          : "Exact"
                        : isRu
                          ? "Вероятные"
                          : "Likely"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {cards.length} · {Math.round(group.confidence * 100)}%
                    </span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {cards.slice(0, 4).map((card) => (
                      <div key={card.id} className="rounded border border-border p-2 text-xs">
                        <strong className="block line-clamp-2">{card.front}</strong>
                        <span className="mt-1 block line-clamp-2 text-muted-foreground">
                          {card.back}
                        </span>
                      </div>
                    ))}
                  </div>
                  <Button
                    className="mt-3 w-full"
                    variant="outline"
                    onClick={() => setDuplicateGroup(group)}
                  >
                    <GitMerge className="h-4 w-4 me-1" />
                    {isRu ? "Проверить и объединить" : "Review and merge"}
                  </Button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{isRu ? "Режим повторения" : "Review mode"}</DialogTitle>
          </DialogHeader>
          <ReviewMode cards={dueCards} onDone={() => setReviewOpen(false)} />
        </DialogContent>
      </Dialog>

      <BulkRelinkDialog
        open={bulkRelinkOpen}
        onOpenChange={setBulkRelinkOpen}
        cards={selectedCards}
        onApplied={() => setSelectedIds([])}
      />

      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isRu ? "Удалить выбранные карточки?" : "Delete selected flashcards?"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {isRu
              ? `${selectedCards.length} карточек будут удалены без возможности восстановления. Источники и материалы не изменятся.`
              : `${selectedCards.length} cards will be permanently removed. Source materials will not be changed.`}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>
              {isRu ? "Отмена" : "Cancel"}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                for (const card of selectedCards) store.deleteCard(card.id);
                setSelectedIds([]);
                setBulkDeleteOpen(false);
                toast.success(isRu ? "Карточки удалены" : "Flashcards deleted");
              }}
            >
              <Trash2 className="h-4 w-4 me-1" />
              {isRu ? "Удалить" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DuplicateMergeDialog
        group={duplicateGroup}
        onOpenChange={(open) => !open && setDuplicateGroup(null)}
      />

      <CsvImportDialog rows={importRows} onOpenChange={(open) => !open && setImportRows(null)} />
    </div>
  );
}

function FlashcardRow({
  card,
  selected,
  onSelectedChange,
}: {
  card: Flashcard;
  selected: boolean;
  onSelectedChange: (selected: boolean) => void;
}) {
  const { lang } = useApp();
  const isRu = lang === "ru";
  const data = useData();
  const course = data.courses.find((item) => item.id === card.courseId);
  const topic = data.topics.find((item) => item.id === card.topicId);
  const material = data.materials.find((item) => item.id === card.materialId);
  const sourceCount = card.sourceChunkIds?.length ?? 0;

  return (
    <article
      className={`grid gap-3 rounded-xl border bg-surface p-3 lg:grid-cols-[32px_minmax(0,1fr)_minmax(0,1fr)_250px_36px] ${selected ? "border-primary/60" : "border-border"}`}
    >
      <button
        type="button"
        className="mt-2 text-primary"
        aria-label={selected ? (isRu ? "Снять выбор" : "Deselect") : isRu ? "Выбрать" : "Select"}
        onClick={() => onSelectedChange(!selected)}
      >
        {selected ? <CheckSquare2 className="h-4 w-4" /> : <Square className="h-4 w-4" />}
      </button>
      <div>
        <Label className="text-[10px] uppercase text-muted-foreground">
          {isRu ? "Вопрос" : "Front"}
        </Label>
        <Textarea
          dir="auto"
          className="mt-1 min-h-[88px] resize-y"
          value={card.front}
          onChange={(event) => store.updateCard(card.id, { front: event.target.value })}
        />
      </div>
      <div>
        <Label className="text-[10px] uppercase text-muted-foreground">
          {isRu ? "Ответ" : "Back"}
        </Label>
        <Textarea
          dir="auto"
          className="mt-1 min-h-[88px] resize-y"
          value={card.back}
          onChange={(event) => store.updateCard(card.id, { back: event.target.value })}
        />
      </div>
      <div className="flex min-w-0 flex-col justify-between gap-2 text-xs">
        <div className="space-y-1 text-muted-foreground">
          <div className="truncate">{course?.title ?? (isRu ? "Без курса" : "No course")}</div>
          <div className="truncate">{topic?.title ?? (isRu ? "Без темы" : "No topic")}</div>
          {material ? (
            <Link
              to="/app/materials/$materialId"
              params={{ materialId: material.id }}
              className="inline-flex max-w-full items-center gap-1 text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3 shrink-0" />
              <span className="truncate">{material.title}</span>
            </Link>
          ) : (
            <div>{isRu ? "Без материала" : "No material"}</div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={card.status} isRu={isRu} />
          {sourceCount > 0 && (
            <span className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {sourceCount} {isRu ? "источн." : "sources"}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">
            {isRu ? "Повтор" : "Due"}:{" "}
            {new Date(card.dueAt).toLocaleDateString(isRu ? "ru-RU" : "en-GB")}
          </span>
        </div>
      </div>
      <Button
        size="icon"
        variant="ghost"
        aria-label={isRu ? "Удалить карточку" : "Delete flashcard"}
        onClick={() => {
          const confirmed = confirm(isRu ? "Удалить эту карточку?" : "Delete this flashcard?");
          if (confirmed) store.deleteCard(card.id);
        }}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </article>
  );
}

function CreateCardForm({ onDone }: { onDone: () => void }) {
  const { lang } = useApp();
  const isRu = lang === "ru";
  const data = useData();
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [courseId, setCourseId] = useState("_none");
  const [topicId, setTopicId] = useState("_none");
  const [materialId, setMaterialId] = useState("_none");
  const topics = data.topics.filter((topic) => courseId === "_none" || topic.courseId === courseId);
  const materials = data.materials.filter(
    (material) => courseId === "_none" || !material.courseId || material.courseId === courseId,
  );

  return (
    <div className="space-y-4">
      <div>
        <Label>{isRu ? "Вопрос / лицевая сторона" : "Prompt / front"}</Label>
        <Textarea
          dir="auto"
          className="mt-1 min-h-[110px]"
          value={front}
          onChange={(event) => setFront(event.target.value)}
        />
      </div>
      <div>
        <Label>{isRu ? "Ответ / обратная сторона" : "Answer / back"}</Label>
        <Textarea
          dir="auto"
          className="mt-1 min-h-[110px]"
          value={back}
          onChange={(event) => setBack(event.target.value)}
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <Select
          value={courseId}
          onValueChange={(value) => {
            setCourseId(value);
            setTopicId("_none");
            setMaterialId("_none");
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">{isRu ? "Без курса" : "No course"}</SelectItem>
            {data.courses.map((course) => (
              <SelectItem key={course.id} value={course.id}>
                {course.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={topicId} onValueChange={setTopicId} disabled={courseId === "_none"}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">{isRu ? "Без темы" : "No topic"}</SelectItem>
            {topics.map((topic) => (
              <SelectItem key={topic.id} value={topic.id}>
                {topic.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={materialId} onValueChange={setMaterialId}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">{isRu ? "Без материала" : "No material"}</SelectItem>
            {materials.map((material) => (
              <SelectItem key={material.id} value={material.id}>
                {material.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          {isRu ? "Отмена" : "Cancel"}
        </Button>
        <Button
          disabled={!front.trim() || !back.trim()}
          onClick={() => {
            store.createCard({
              front: front.trim(),
              back: back.trim(),
              courseId: courseId === "_none" ? undefined : courseId,
              topicId: topicId === "_none" ? undefined : topicId,
              materialId: materialId === "_none" ? undefined : materialId,
              sourceChunkIds: [],
            });
            toast.success(isRu ? "Карточка создана" : "Flashcard created");
            onDone();
          }}
        >
          {isRu ? "Создать" : "Create"}
        </Button>
      </DialogFooter>
    </div>
  );
}

function ReviewMode({ cards, onDone }: { cards: Flashcard[]; onDone: () => void }) {
  const { lang } = useApp();
  const isRu = lang === "ru";
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = cards[index];

  if (!card) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">
          {isRu ? "Карточки к повторению закончились." : "No more cards are due."}
        </p>
        <Button className="mt-4" onClick={onDone}>
          {isRu ? "Закрыть" : "Close"}
        </Button>
      </div>
    );
  }

  const rate = (quality: "again" | "good" | "easy") => {
    store.reviewCard(card.id, quality);
    setIndex((current) => current + 1);
    setFlipped(false);
  };

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground">
        {index + 1} / {cards.length}
      </div>
      <button
        type="button"
        className="flex min-h-[240px] w-full items-center justify-center rounded-xl border border-border bg-background p-8 text-center"
        onClick={() => setFlipped((value) => !value)}
      >
        <span dir="auto" className="text-xl leading-8">
          {flipped ? card.back : card.front}
        </span>
      </button>
      {flipped ? (
        <div className="grid grid-cols-3 gap-2">
          <Button variant="destructive" onClick={() => rate("again")}>
            {isRu ? "Снова" : "Again"}
          </Button>
          <Button variant="outline" onClick={() => rate("good")}>
            {isRu ? "Нормально" : "Good"}
          </Button>
          <Button onClick={() => rate("easy")}>{isRu ? "Легко" : "Easy"}</Button>
        </div>
      ) : (
        <Button className="w-full" onClick={() => setFlipped(true)}>
          {isRu ? "Показать ответ" : "Show answer"}
        </Button>
      )}
    </div>
  );
}

function BulkRelinkDialog({
  open,
  onOpenChange,
  cards,
  onApplied,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cards: Flashcard[];
  onApplied: () => void;
}) {
  const { lang } = useApp();
  const isRu = lang === "ru";
  const data = useData();
  const [courseId, setCourseId] = useState("_keep");
  const [topicId, setTopicId] = useState("_keep");
  const [materialId, setMaterialId] = useState("_keep");
  const topics = data.topics.filter(
    (topic) => courseId !== "_keep" && courseId !== "_none" && topic.courseId === courseId,
  );
  const materials = data.materials.filter(
    (material) =>
      courseId === "_keep" ||
      courseId === "_none" ||
      !material.courseId ||
      material.courseId === courseId,
  );

  const apply = () => {
    for (const card of cards) {
      const patch: Partial<Flashcard> = {};
      if (courseId !== "_keep") patch.courseId = courseId === "_none" ? undefined : courseId;
      if (topicId !== "_keep") patch.topicId = topicId === "_none" ? undefined : topicId;
      if (materialId !== "_keep")
        patch.materialId = materialId === "_none" ? undefined : materialId;
      store.updateCard(card.id, patch);
    }
    toast.success(isRu ? "Привязки обновлены" : "Links updated");
    onApplied();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setCourseId("_keep");
          setTopicId("_keep");
          setMaterialId("_keep");
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isRu ? "Массовая перепривязка" : "Bulk relink"}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {isRu
            ? `${cards.length} карточек. Связи с конкретными фрагментами источника останутся нетронутыми.`
            : `${cards.length} cards. Exact source-chunk references remain untouched.`}
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label>{isRu ? "Курс" : "Course"}</Label>
            <Select
              value={courseId}
              onValueChange={(value) => {
                setCourseId(value);
                setTopicId(value === "_keep" ? "_keep" : "_none");
              }}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_keep">{isRu ? "Не менять" : "Keep current"}</SelectItem>
                <SelectItem value="_none">{isRu ? "Убрать курс" : "Remove course"}</SelectItem>
                {data.courses.map((course) => (
                  <SelectItem key={course.id} value={course.id}>
                    {course.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{isRu ? "Тема" : "Topic"}</Label>
            <Select value={topicId} onValueChange={setTopicId} disabled={courseId === "_keep"}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {courseId === "_keep" && (
                  <SelectItem value="_keep">{isRu ? "Не менять" : "Keep current"}</SelectItem>
                )}
                <SelectItem value="_none">{isRu ? "Убрать тему" : "Remove topic"}</SelectItem>
                {topics.map((topic) => (
                  <SelectItem key={topic.id} value={topic.id}>
                    {topic.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{isRu ? "Материал" : "Material"}</Label>
            <Select value={materialId} onValueChange={setMaterialId}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_keep">{isRu ? "Не менять" : "Keep current"}</SelectItem>
                <SelectItem value="_none">
                  {isRu ? "Убрать материал" : "Remove material"}
                </SelectItem>
                {materials.map((material) => (
                  <SelectItem key={material.id} value={material.id}>
                    {material.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {isRu ? "Отмена" : "Cancel"}
          </Button>
          <Button onClick={apply} disabled={cards.length === 0}>
            {isRu ? "Применить" : "Apply"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DuplicateMergeDialog({
  group,
  onOpenChange,
}: {
  group: DuplicateGroup | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { lang } = useApp();
  const isRu = lang === "ru";
  const data = useData();
  const cards = group
    ? group.cardIds
        .map((id) => data.flashcards.find((card) => card.id === id))
        .filter((card): card is Flashcard => Boolean(card))
    : [];
  const [keeperId, setKeeperId] = useState("");
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");

  const openChanged = (open: boolean) => {
    if (open && cards[0]) {
      setKeeperId(cards[0].id);
      setFront(cards[0].front);
      setBack(cards[0].back);
    }
    onOpenChange(open);
  };

  const keeper = cards.find((card) => card.id === keeperId) ?? cards[0];

  const merge = () => {
    if (!keeper || !front.trim() || !back.trim()) return;
    const sourceChunkIds = Array.from(new Set(cards.flatMap((card) => card.sourceChunkIds ?? [])));
    store.updateCard(keeper.id, {
      front: front.trim(),
      back: back.trim(),
      sourceChunkIds,
    });
    for (const card of cards) {
      if (card.id !== keeper.id) store.deleteCard(card.id);
    }
    toast.success(
      isRu
        ? `Оставлена 1 карточка, удалено ${Math.max(0, cards.length - 1)} дубликатов`
        : `Kept 1 card and removed ${Math.max(0, cards.length - 1)} duplicates`,
    );
    onOpenChange(false);
  };

  return (
    <Dialog open={Boolean(group)} onOpenChange={openChanged}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {isRu ? "Проверка группы дубликатов" : "Review duplicate group"}
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          {isRu
            ? "Выбери карточку, которая сохранит историю повторений. Текст можно исправить. Ссылки на источники будут объединены. Остальные карточки удалятся только после подтверждения."
            : "Choose the card that keeps review history. Edit the final text if needed. Source references are combined. Other cards are removed only after confirmation."}
        </p>
        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="max-h-80 space-y-2 overflow-auto">
            {cards.map((card) => (
              <button
                key={card.id}
                type="button"
                className={`w-full rounded-lg border p-3 text-start text-xs ${keeperId === card.id ? "border-primary bg-primary/10" : "border-border bg-background"}`}
                onClick={() => {
                  setKeeperId(card.id);
                  setFront(card.front);
                  setBack(card.back);
                }}
              >
                <span className="flex items-center gap-2">
                  <input type="radio" readOnly checked={keeperId === card.id} />
                  <strong className="line-clamp-2">{card.front}</strong>
                </span>
                <span className="mt-2 block line-clamp-3 text-muted-foreground">{card.back}</span>
                <span className="mt-2 block text-[10px] text-muted-foreground">
                  {card.sourceChunkIds?.length ?? 0}{" "}
                  {isRu ? "ссылок на источник" : "source references"}
                </span>
              </button>
            ))}
          </div>
          <div className="space-y-3">
            <div>
              <Label>{isRu ? "Итоговый вопрос" : "Final front"}</Label>
              <Textarea
                dir="auto"
                className="mt-1 min-h-[130px]"
                value={front}
                onChange={(event) => setFront(event.target.value)}
              />
            </div>
            <div>
              <Label>{isRu ? "Итоговый ответ" : "Final back"}</Label>
              <Textarea
                dir="auto"
                className="mt-1 min-h-[180px]"
                value={back}
                onChange={(event) => setBack(event.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="rounded-md border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-200">
          {isRu
            ? `После подтверждения будет удалено ${Math.max(0, cards.length - 1)} карточек. Отменить это действие нельзя.`
            : `${Math.max(0, cards.length - 1)} cards will be deleted after confirmation. This cannot be undone.`}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {isRu ? "Отмена" : "Cancel"}
          </Button>
          <Button
            variant="destructive"
            onClick={merge}
            disabled={!keeper || !front.trim() || !back.trim()}
          >
            <GitMerge className="h-4 w-4 me-1" />
            {isRu ? "Объединить и удалить дубликаты" : "Merge and remove duplicates"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CsvImportDialog({
  rows,
  onOpenChange,
}: {
  rows: ImportedCardRow[] | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { lang } = useApp();
  const isRu = lang === "ru";
  const valid = rows?.filter((row) => row.valid) ?? [];
  const invalid = rows?.filter((row) => !row.valid) ?? [];

  return (
    <Dialog open={Boolean(rows)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isRu ? "Предпросмотр импорта CSV" : "CSV import preview"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <SummaryCell label={isRu ? "Готово к импорту" : "Ready"} value={valid.length} />
          <SummaryCell label={isRu ? "Пропущено" : "Skipped"} value={invalid.length} />
        </div>
        <div className="max-h-96 space-y-2 overflow-auto">
          {(rows ?? []).slice(0, 30).map((row, index) => (
            <div
              key={index}
              className={`rounded-lg border p-3 text-xs ${row.valid ? "border-border" : "border-red-500/30 bg-red-500/5"}`}
            >
              <strong className="block">{row.front || "—"}</strong>
              <span className="mt-1 block text-muted-foreground">{row.back || "—"}</span>
              {row.warning && <span className="mt-2 block text-yellow-200">{row.warning}</span>}
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {isRu
            ? "Импорт создаёт новые карточки. Существующие карточки не меняются; дубликаты можно разобрать после импорта в соответствующем блоке."
            : "Import creates new cards. Existing cards are unchanged; duplicates can be reviewed afterward in the duplicate section."}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {isRu ? "Отмена" : "Cancel"}
          </Button>
          <Button
            disabled={valid.length === 0}
            onClick={() => {
              for (const row of valid) {
                store.createCard({
                  front: row.front,
                  back: row.back,
                  courseId: row.courseId,
                  topicId: row.topicId,
                  materialId: row.materialId,
                  sourceChunkIds: row.sourceChunkIds,
                });
              }
              toast.success(
                isRu ? `Импортировано ${valid.length} карточек` : `Imported ${valid.length} cards`,
              );
              onOpenChange(false);
            }}
          >
            <FileUp className="h-4 w-4 me-1" />
            {isRu ? "Импортировать" : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatusBadge({ status, isRu }: { status: CardStatus; isRu: boolean }) {
  const label =
    status === "new"
      ? isRu
        ? "Новая"
        : "New"
      : status === "learning"
        ? isRu
          ? "В изучении"
          : "Learning"
        : isRu
          ? "Освоена"
          : "Mastered";
  return (
    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">{label}</span>
  );
}

function SummaryCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}

function detectDuplicateGroups(cards: Flashcard[]): DuplicateGroup[] {
  const candidates = cards.filter(
    (card) => normalizeText(card.front).length >= 3 && normalizeText(card.back).length >= 2,
  );
  const parent = new Map(candidates.map((card) => [card.id, card.id]));
  const edgeKinds = new Map<string, "exact" | "likely">();
  const edgeScores = new Map<string, number>();

  const find = (id: string): string => {
    const value = parent.get(id) ?? id;
    if (value === id) return id;
    const root = find(value);
    parent.set(id, root);
    return root;
  };
  const union = (a: string, b: string) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent.set(rootB, rootA);
  };

  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      const a = candidates[i];
      const b = candidates[j];
      const exact = duplicateKey(a) === duplicateKey(b);
      const score = exact ? 1 : duplicateSimilarity(a, b);
      if (!exact && score < 0.76) continue;
      const key = pairKey(a.id, b.id);
      edgeKinds.set(key, exact ? "exact" : "likely");
      edgeScores.set(key, score);
      union(a.id, b.id);
    }
  }

  const grouped = new Map<string, string[]>();
  for (const card of candidates) {
    const root = find(card.id);
    const ids = grouped.get(root) ?? [];
    ids.push(card.id);
    grouped.set(root, ids);
  }

  return Array.from(grouped.values())
    .filter((ids) => ids.length > 1)
    .map((ids) => {
      const edges: Array<{ kind: "exact" | "likely"; score: number }> = [];
      for (let i = 0; i < ids.length; i += 1) {
        for (let j = i + 1; j < ids.length; j += 1) {
          const key = pairKey(ids[i], ids[j]);
          const kind = edgeKinds.get(key);
          const score = edgeScores.get(key);
          if (kind && score != null) edges.push({ kind, score });
        }
      }
      const kind =
        edges.length > 0 && edges.every((edge) => edge.kind === "exact") ? "exact" : "likely";
      const confidence = edges.length
        ? edges.reduce((sum, edge) => sum + edge.score, 0) / edges.length
        : 0.76;
      return {
        id: `dup_${ids.slice().sort().join("_")}`,
        kind,
        cardIds: ids,
        confidence,
      } satisfies DuplicateGroup;
    })
    .sort((a, b) =>
      a.kind === b.kind ? b.confidence - a.confidence : a.kind === "exact" ? -1 : 1,
    );
}

function duplicateSimilarity(a: Flashcard, b: Flashcard): number {
  const front = tokenSimilarity(a.front, b.front);
  const back = tokenSimilarity(a.back, b.back);
  const sameFront = normalizeText(a.front) === normalizeText(b.front);
  if (sameFront && back >= 0.45) return Math.max(0.8, (front + back) / 2);
  return front * 0.65 + back * 0.35;
}

function tokenSimilarity(a: string, b: string): number {
  const left = new Set(normalizeText(a).split(" ").filter(Boolean));
  const right = new Set(normalizeText(b).split(" ").filter(Boolean));
  if (left.size === 0 || right.size === 0) return 0;
  const intersection = Array.from(left).filter((token) => right.has(token)).length;
  const union = new Set([...left, ...right]).size;
  return union ? intersection / union : 0;
}

function duplicateKey(card: Flashcard): string {
  return `${normalizeText(card.front)}::${normalizeText(card.back)}`;
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join("::");
}

function normalizeText(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u0591-\u05c7]/g, "")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function csvEscape(value: string): string {
  const escaped = value.replace(/"/g, '""');
  return /[",\r\n]/.test(value) ? `"${escaped}"` : escaped;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function validateImportedRow(
  row: string[],
  index: Record<string, number>,
  data: ReturnType<typeof useData>,
): ImportedCardRow {
  const value = (key: string) => (index[key] == null ? "" : (row[index[key]] ?? "")).trim();
  const front = value("front");
  const back = value("back");
  const rawCourseId = value("courseId");
  const rawTopicId = value("topicId");
  const rawMaterialId = value("materialId");
  const courseId = data.courses.some((course) => course.id === rawCourseId)
    ? rawCourseId
    : undefined;
  const topicId = data.topics.some((topic) => topic.id === rawTopicId) ? rawTopicId : undefined;
  const materialId = data.materials.some((material) => material.id === rawMaterialId)
    ? rawMaterialId
    : undefined;
  const validChunkIds = new Set(data.materialChunks.map((chunk) => chunk.id));
  const sourceChunkIds = value("sourceChunkIds")
    .split("|")
    .map((id) => id.trim())
    .filter((id) => id && validChunkIds.has(id));
  const missingLinks = [
    rawCourseId && !courseId ? "courseId" : "",
    rawTopicId && !topicId ? "topicId" : "",
    rawMaterialId && !materialId ? "materialId" : "",
  ].filter(Boolean);
  return {
    front,
    back,
    courseId,
    topicId,
    materialId,
    sourceChunkIds,
    valid: Boolean(front && back),
    warning: missingLinks.length ? `Unknown links ignored: ${missingLinks.join(", ")}` : undefined,
  };
}

function downloadFile(fileName: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
