import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  CheckSquare,
  Download,
  ExternalLink,
  FileQuestion,
  Heading1,
  Heading2,
  List,
  ListChecks,
  Quote,
  Save,
  Sparkles,
  Table2,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { getChunksByMaterial, store, useData, type Note } from "@/lib/store";

interface NoteDraftState {
  title: string;
  content: string;
  tags: string[];
  courseId?: string;
  topicId?: string;
  materialId?: string;
  sourceChunkIds: string[];
}

type SaveState = "saved" | "unsaved" | "saving" | "error";
type ConvertMode = "flashcard" | "quiz" | null;

export function NoteEditorWorkspace({ noteId }: { noteId: string }) {
  const { lang } = useApp();
  const isRu = lang === "ru";
  const data = useData();
  const navigate = useNavigate();
  const note = data.notes.find((item) => item.id === noteId);

  if (!note) {
    return (
      <div className="mx-auto max-w-5xl">
        <Button variant="ghost" onClick={() => navigate({ to: "/app/notes" })}>
          <ArrowLeft className="h-4 w-4 me-1" />
          {isRu ? "К конспектам" : "Back to notes"}
        </Button>
        <div className="mt-4 rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          {isRu ? "Конспект удалён или не найден" : "The note was deleted or could not be found"}
        </div>
      </div>
    );
  }

  return <ExistingNoteEditor key={note.id} note={note} />;
}

function ExistingNoteEditor({ note }: { note: Note }) {
  const { lang } = useApp();
  const isRu = lang === "ru";
  const data = useData();
  const navigate = useNavigate();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState<NoteDraftState>(() => fromNote(note));
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [selectedText, setSelectedText] = useState("");
  const [convertMode, setConvertMode] = useState<ConvertMode>(null);
  const lastSavedRef = useRef(JSON.stringify(fromNote(note)));
  const draftRef = useRef(draft);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const material = draft.materialId
    ? data.materials.find((item) => item.id === draft.materialId)
    : undefined;
  const sourceChunks = material ? getChunksByMaterial(data, material.id) : [];
  const linkedChunks = sourceChunks.filter((chunk) => draft.sourceChunkIds.includes(chunk.id));
  const topics = data.topics.filter(
    (topic) => !draft.courseId || topic.courseId === draft.courseId,
  );
  const sourceGaps = useMemo(
    () => findMissingSourceSections(draft.content, linkedChunks),
    [draft.content, linkedChunks],
  );

  const persistDraft = useCallback(
    (value: NoteDraftState) => {
      setSaveState("saving");
      try {
        store.updateNote(note.id, {
          title: value.title,
          content: value.content,
          tags: value.tags,
          courseId: value.courseId,
          topicId: value.topicId,
          materialId: value.materialId,
          sourceChunkIds: value.sourceChunkIds,
        });
        lastSavedRef.current = JSON.stringify(value);
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    },
    [note.id],
  );

  useEffect(() => {
    draftRef.current = draft;
    const serialized = JSON.stringify(draft);
    if (serialized === lastSavedRef.current) return;
    setSaveState("unsaved");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => persistDraft(draft), 700);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [draft, persistDraft]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (JSON.stringify(draftRef.current) === lastSavedRef.current) return;
      persistDraft(draftRef.current);
      event.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      if (JSON.stringify(draftRef.current) !== lastSavedRef.current) {
        persistDraft(draftRef.current);
      }
    };
  }, [persistDraft]);

  const updateDraft = (patch: Partial<NoteDraftState>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const captureSelection = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    setSelectedText(textarea.value.slice(textarea.selectionStart, textarea.selectionEnd).trim());
  };

  const insertMarkdown = (prefix: string, suffix = "", placeholder = isRu ? "текст" : "text") => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = draft.content.slice(start, end) || placeholder;
    const next = `${draft.content.slice(0, start)}${prefix}${selected}${suffix}${draft.content.slice(end)}`;
    updateDraft({ content: next });
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    });
  };

  const toggleChunk = (chunkId: string) => {
    updateDraft({
      sourceChunkIds: draft.sourceChunkIds.includes(chunkId)
        ? draft.sourceChunkIds.filter((id) => id !== chunkId)
        : [...draft.sourceChunkIds, chunkId],
    });
  };

  return (
    <div className="mx-auto max-w-[1440px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="ghost"
          onClick={() => {
            if (JSON.stringify(draftRef.current) !== lastSavedRef.current) {
              persistDraft(draftRef.current);
            }
            navigate({ to: "/app/notes" });
          }}
        >
          <ArrowLeft className="h-4 w-4 me-1" />
          {isRu ? "К конспектам" : "Back to notes"}
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <SaveIndicator state={saveState} isRu={isRu} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadMarkdown(draft.title, draft.content)}
          >
            <Download className="h-4 w-4 me-1" />
            Markdown
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              const confirmed = confirm(isRu ? "Удалить этот конспект?" : "Delete this note?");
              if (!confirmed) return;
              store.deleteNote(note.id);
              navigate({ to: "/app/notes" });
            }}
          >
            <Trash2 className="h-4 w-4 me-1" />
            {isRu ? "Удалить" : "Delete"}
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <main className="min-w-0 rounded-xl border border-border bg-surface">
          <div className="border-b border-border p-4 md:p-5">
            <Input
              dir="auto"
              value={draft.title}
              aria-label={isRu ? "Название конспекта" : "Note title"}
              onChange={(event) => updateDraft({ title: event.target.value })}
              className="h-auto border-transparent bg-transparent p-0 font-serif text-2xl font-semibold hover:border-input focus:border-input md:text-3xl"
            />
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <Select
                value={draft.courseId ?? "_none"}
                onValueChange={(value) =>
                  updateDraft({
                    courseId: value === "_none" ? undefined : value,
                    topicId: undefined,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={isRu ? "Курс" : "Course"} />
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
              <Select
                value={draft.topicId ?? "_none"}
                disabled={!draft.courseId}
                onValueChange={(value) =>
                  updateDraft({ topicId: value === "_none" ? undefined : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={isRu ? "Тема" : "Topic"} />
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
              <Select
                value={draft.materialId ?? "_none"}
                onValueChange={(value) => {
                  const materialId = value === "_none" ? undefined : value;
                  updateDraft({ materialId, sourceChunkIds: [] });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isRu ? "Источник" : "Source"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">{isRu ? "Без источника" : "No source"}</SelectItem>
                  {data.materials
                    .filter(
                      (item) =>
                        !draft.courseId || !item.courseId || item.courseId === draft.courseId,
                    )
                    .map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.title}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              className="mt-2"
              value={draft.tags.join(", ")}
              placeholder={isRu ? "Теги через запятую" : "Comma-separated tags"}
              onChange={(event) =>
                updateDraft({
                  tags: event.target.value
                    .split(",")
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                })
              }
            />
          </div>

          <MarkdownToolbar insert={insertMarkdown} isRu={isRu} />

          <div className="p-4 md:p-5">
            <Textarea
              ref={textareaRef}
              dir="auto"
              className="min-h-[560px] resize-y border-0 bg-background font-mono text-sm leading-7 focus-visible:ring-1"
              value={draft.content}
              onChange={(event) => updateDraft({ content: event.target.value })}
              onSelect={captureSelection}
              onKeyUp={captureSelection}
              onMouseUp={captureSelection}
              placeholder={
                isRu
                  ? "Пиши в Markdown: заголовки, списки, таблицы, цитаты и чеклисты…"
                  : "Write in Markdown: headings, lists, tables, quotes, and checklists…"
              }
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <span>
                {draft.content.length.toLocaleString()} {isRu ? "знаков" : "characters"}
              </span>
              <span>
                {countWords(draft.content).toLocaleString()} {isRu ? "слов" : "words"}
              </span>
            </div>
          </div>
        </main>

        <aside className="space-y-4">
          <section className="rounded-xl border border-border bg-surface p-4">
            <h2 className="font-semibold">{isRu ? "Выделенный текст" : "Selected text"}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {selectedText
                ? `${selectedText.length} ${isRu ? "знаков выделено" : "characters selected"}`
                : isRu
                  ? "Выдели фрагмент в редакторе, чтобы превратить его в учебный элемент."
                  : "Select text in the editor to turn it into a study item."}
            </p>
            <div className="mt-3 grid gap-2">
              <Button
                variant="outline"
                disabled={!selectedText}
                onClick={() => setConvertMode("flashcard")}
              >
                <Sparkles className="h-4 w-4 me-1" />
                {isRu ? "Сделать карточку" : "Create flashcard"}
              </Button>
              <Button
                variant="outline"
                disabled={!selectedText}
                onClick={() => setConvertMode("quiz")}
              >
                <FileQuestion className="h-4 w-4 me-1" />
                {isRu ? "Сделать вопрос" : "Create question"}
              </Button>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">
                {isRu ? "Связь с источником" : "Source relationship"}
              </h2>
              {material && (
                <Link
                  to="/app/materials/$materialId"
                  params={{ materialId: material.id }}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {isRu ? "Открыть" : "Open"}
                </Link>
              )}
            </div>
            {!material ? (
              <p className="mt-3 text-xs text-muted-foreground">
                {isRu
                  ? "Конспект пока не связан с материалом."
                  : "This note is not linked to source material."}
              </p>
            ) : sourceChunks.length === 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">
                {isRu
                  ? "У материала нет отдельных фрагментов."
                  : "The material has no extracted chunks."}
              </p>
            ) : (
              <div className="mt-3 max-h-72 space-y-1 overflow-auto rounded-md border border-border bg-background p-1">
                {sourceChunks.map((chunk) => {
                  const checked = draft.sourceChunkIds.includes(chunk.id);
                  return (
                    <button
                      key={chunk.id}
                      type="button"
                      className={`w-full rounded p-2 text-start text-xs ${checked ? "border border-primary/40 bg-primary/10" : "hover:bg-accent"}`}
                      onClick={() => toggleChunk(chunk.id)}
                    >
                      <span className="flex items-start gap-2">
                        {checked ? (
                          <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        ) : (
                          <span className="mt-0.5 h-4 w-4 shrink-0 rounded border border-border" />
                        )}
                        <span className="min-w-0">
                          <strong className="block truncate">
                            {chunk.title || `${isRu ? "Фрагмент" : "Chunk"} ${chunk.order + 1}`}
                          </strong>
                          <span className="mt-1 block line-clamp-2 text-muted-foreground">
                            {chunk.text}
                          </span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-border bg-surface p-4">
            <h2 className="font-semibold">
              {isRu ? "Сравнение с источником" : "Compare with source"}
            </h2>
            {!material || linkedChunks.length === 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">
                {isRu
                  ? "Выбери материал и связанные фрагменты, чтобы увидеть возможные пробелы."
                  : "Choose source material and linked chunks to see possible gaps."}
              </p>
            ) : sourceGaps.length === 0 ? (
              <div className="mt-3 flex items-start gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-200">
                <Check className="mt-0.5 h-4 w-4" />
                {isRu
                  ? "Названия и ключевые термины выбранных разделов встречаются в конспекте."
                  : "Selected section titles and key terms appear in the note."}
              </div>
            ) : (
              <div className="mt-3">
                <p className="text-xs text-yellow-200">
                  {isRu
                    ? "Возможно, эти разделы источника раскрыты недостаточно:"
                    : "These source sections may be missing or underrepresented:"}
                </p>
                <ul className="mt-2 list-disc space-y-1 ps-5 text-xs text-muted-foreground">
                  {sourceGaps.map((gap) => (
                    <li key={gap}>{gap}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </aside>
      </div>

      <ConvertSelectionDialog
        mode={convertMode}
        onOpenChange={(open) => !open && setConvertMode(null)}
        selectedText={selectedText}
        note={note}
        draft={draft}
      />
    </div>
  );
}

function MarkdownToolbar({
  insert,
  isRu,
}: {
  insert: (prefix: string, suffix?: string, placeholder?: string) => void;
  isRu: boolean;
}) {
  const actions = [
    { icon: Heading1, label: "H1", run: () => insert("# ", "", isRu ? "Заголовок" : "Heading") },
    { icon: Heading2, label: "H2", run: () => insert("## ", "", isRu ? "Раздел" : "Section") },
    {
      icon: List,
      label: isRu ? "Список" : "List",
      run: () => insert("- ", "", isRu ? "пункт" : "item"),
    },
    {
      icon: ListChecks,
      label: isRu ? "Чеклист" : "Checklist",
      run: () => insert("- [ ] ", "", isRu ? "задача" : "task"),
    },
    {
      icon: Quote,
      label: isRu ? "Цитата" : "Quote",
      run: () => insert("> ", "", isRu ? "цитата" : "quote"),
    },
    {
      icon: Table2,
      label: isRu ? "Таблица" : "Table",
      run: () => insert("| Термин | Объяснение |\n|---|---|\n| ", " |  |"),
    },
  ];
  return (
    <div className="flex flex-wrap gap-1 border-b border-border bg-background/50 p-2">
      {actions.map(({ icon: Icon, label, run }) => (
        <Button key={label} type="button" size="sm" variant="ghost" onClick={run}>
          <Icon className="h-3.5 w-3.5 me-1" />
          {label}
        </Button>
      ))}
    </div>
  );
}

function SaveIndicator({ state, isRu }: { state: SaveState; isRu: boolean }) {
  const copy = {
    saved: isRu ? "Сохранено" : "Saved",
    unsaved: isRu ? "Есть изменения" : "Unsaved changes",
    saving: isRu ? "Сохраняю…" : "Saving…",
    error: isRu ? "Ошибка сохранения" : "Save failed",
  }[state];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs ${
        state === "saved"
          ? "bg-emerald-500/10 text-emerald-300"
          : state === "error"
            ? "bg-red-500/10 text-red-300"
            : "bg-yellow-500/10 text-yellow-200"
      }`}
    >
      <Save className="h-3.5 w-3.5" />
      {copy}
    </span>
  );
}

function ConvertSelectionDialog({
  mode,
  onOpenChange,
  selectedText,
  note,
  draft,
}: {
  mode: ConvertMode;
  onOpenChange: (open: boolean) => void;
  selectedText: string;
  note: Note;
  draft: NoteDraftState;
}) {
  const { lang } = useApp();
  const isRu = lang === "ru";
  const [front, setFront] = useState("");
  const [back, setBack] = useState(selectedText);
  const [quizTitle, setQuizTitle] = useState(`${draft.title} — ${isRu ? "вопросы" : "questions"}`);
  const [prompt, setPrompt] = useState("");
  const [options, setOptions] = useState([selectedText, "", "", ""]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [explanation, setExplanation] = useState(selectedText);

  useEffect(() => {
    if (!mode) return;
    setFront("");
    setBack(selectedText);
    setQuizTitle(`${draft.title} — ${isRu ? "вопросы" : "questions"}`);
    setPrompt("");
    setOptions([selectedText, "", "", ""]);
    setCorrectIndex(0);
    setExplanation(selectedText);
  }, [mode, selectedText, draft.title, isRu]);

  const saveCard = () => {
    if (!front.trim() || !back.trim()) return;
    store.createCard({
      front: front.trim(),
      back: back.trim(),
      courseId: draft.courseId,
      topicId: draft.topicId,
      materialId: draft.materialId,
      sourceChunkIds: draft.sourceChunkIds,
    });
    toast.success(isRu ? "Карточка создана" : "Flashcard created");
    onOpenChange(false);
  };

  const saveQuestion = () => {
    if (!quizTitle.trim() || !prompt.trim() || options.some((option) => !option.trim())) return;
    const quiz = store.createQuiz({
      title: quizTitle.trim(),
      courseId: draft.courseId,
      topicId: draft.topicId,
      materialId: draft.materialId,
    });
    store.addQuestion({
      quizId: quiz.id,
      prompt: prompt.trim(),
      options: options.map((option) => option.trim()),
      correctIndex,
      explanation: explanation.trim() || undefined,
      sourceChunkIds: draft.sourceChunkIds,
    });
    toast.success(isRu ? "Вопрос создан" : "Question created");
    onOpenChange(false);
  };

  return (
    <Dialog open={Boolean(mode)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "flashcard"
              ? isRu
                ? "Карточка из выделенного текста"
                : "Flashcard from selected text"
              : isRu
                ? "Вопрос из выделенного текста"
                : "Question from selected text"}
          </DialogTitle>
        </DialogHeader>
        {mode === "flashcard" ? (
          <div className="space-y-3">
            <div>
              <Label>{isRu ? "Вопрос / лицевая сторона" : "Prompt / front"}</Label>
              <Input dir="auto" value={front} onChange={(event) => setFront(event.target.value)} />
            </div>
            <div>
              <Label>{isRu ? "Ответ" : "Answer"}</Label>
              <Textarea
                dir="auto"
                className="min-h-[180px]"
                value={back}
                onChange={(event) => setBack(event.target.value)}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label>{isRu ? "Название теста" : "Quiz title"}</Label>
              <Input value={quizTitle} onChange={(event) => setQuizTitle(event.target.value)} />
            </div>
            <div>
              <Label>{isRu ? "Вопрос" : "Question"}</Label>
              <Input
                dir="auto"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              {options.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={correctIndex === index}
                    onChange={() => setCorrectIndex(index)}
                  />
                  <Input
                    dir="auto"
                    value={option}
                    placeholder={`${isRu ? "Вариант" : "Option"} ${index + 1}`}
                    onChange={(event) =>
                      setOptions((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? event.target.value : item,
                        ),
                      )
                    }
                  />
                </div>
              ))}
            </div>
            <div>
              <Label>{isRu ? "Объяснение" : "Explanation"}</Label>
              <Textarea
                dir="auto"
                value={explanation}
                onChange={(event) => setExplanation(event.target.value)}
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {isRu ? "Отмена" : "Cancel"}
          </Button>
          <Button
            onClick={mode === "flashcard" ? saveCard : saveQuestion}
            disabled={
              mode === "flashcard"
                ? !front.trim() || !back.trim()
                : !quizTitle.trim() || !prompt.trim() || options.some((option) => !option.trim())
            }
          >
            {isRu ? "Создать" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function fromNote(note: Note): NoteDraftState {
  return {
    title: note.title,
    content: note.content,
    tags: note.tags,
    courseId: note.courseId,
    topicId: note.topicId,
    materialId: note.materialId,
    sourceChunkIds: note.sourceChunkIds ?? [],
  };
}

function findMissingSourceSections(
  noteContent: string,
  chunks: Array<{ id: string; title?: string; text: string; order: number }>,
): string[] {
  const normalizedNote = normalizeText(noteContent);
  return chunks
    .filter((chunk) => {
      const title = normalizeText(chunk.title ?? "");
      const keywords = normalizeText(chunk.text)
        .split(" ")
        .filter((word) => word.length >= 5)
        .slice(0, 8);
      const titleCovered = !title || normalizedNote.includes(title);
      const keywordMatches = keywords.filter((word) => normalizedNote.includes(word)).length;
      return !titleCovered && keywordMatches < Math.min(2, keywords.length);
    })
    .map((chunk) => chunk.title || `Chunk ${chunk.order + 1}`);
}

function normalizeText(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countWords(value: string): number {
  return value.match(/[\p{L}\p{N}]+/gu)?.length ?? 0;
}

function downloadMarkdown(title: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeFileName(title || "note")}.md`;
  link.click();
  URL.revokeObjectURL(url);
}

function safeFileName(value: string): string {
  return (
    value
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120) || "note"
  );
}
