import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, FileImage, FileText, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { useApp } from "@/lib/app-context";
import { useData, type MaterialType } from "@/lib/store";
import type { MaterialQueueItem, MaterialReviewPatch } from "@/components/material-intake-queue";

export function MaterialIntakeReviewDialog({
  item,
  open,
  onOpenChange,
  onSave,
  onRetry,
  onDiscard,
}: {
  item?: MaterialQueueItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (patch: MaterialReviewPatch) => void;
  onRetry: () => void;
  onDiscard: () => void;
}) {
  const { lang } = useApp();
  const data = useData();
  const isRu = lang === "ru";
  const prepared = item?.prepared;
  const [title, setTitle] = useState("");
  const [type, setType] = useState<MaterialType>("other");
  const [courseId, setCourseId] = useState("_none");
  const [topicId, setTopicId] = useState("_none");
  const [tags, setTags] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!item || !prepared) return;
    setTitle(item.options.title?.trim() || prepared.fileName);
    setType(item.options.type ?? prepared.inferredType);
    setCourseId(item.options.courseId ?? "_none");
    setTopicId(item.options.topicId ?? "_none");
    setTags(item.options.tags?.join(", ") ?? "");
  }, [item, prepared]);

  useEffect(() => {
    if (!prepared?.isVisualSource || !item?.file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(item.file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [item?.file, prepared?.isVisualSource]);

  const topics = useMemo(
    () => data.topics.filter((topic) => courseId !== "_none" && topic.courseId === courseId),
    [data.topics, courseId],
  );

  if (!item || !prepared) return null;

  const warning = warningCopy(prepared.extraction.status, isRu, prepared.isVisualSource);
  const patch = (withoutCourse: boolean): MaterialReviewPatch => ({
    title: title.trim() || prepared.fileName,
    type,
    courseId: withoutCourse || courseId === "_none" ? undefined : courseId,
    topicId: withoutCourse || courseId === "_none" || topicId === "_none" ? undefined : topicId,
    tags: tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isRu ? "Проверить материал" : "Review material"}</DialogTitle>
          <DialogDescription>
            {prepared.isVisualSource
              ? isRu
                ? "Проверь фотографию и метаданные. После сохранения открой материал, чтобы запустить OCR и исправить распознавание."
                : "Review the image and metadata. After saving, open the material to run OCR and correct the transcription."
              : isRu
                ? "Исправь распознанные данные до сохранения в библиотеку."
                : "Correct detected metadata before the material enters your library."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
          <div className="space-y-4">
            <div>
              <Label>{isRu ? "Название" : "Title"}</Label>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>

            <div>
              <Label>{isRu ? "Тип материала" : "Material type"}</Label>
              <Select value={type} onValueChange={(value) => setType(value as MaterialType)}>
                <SelectTrigger>
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
                      {materialTypeCopy(value, isRu)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>{isRu ? "Курс" : "Course"}</Label>
              <Select
                value={courseId}
                onValueChange={(value) => {
                  setCourseId(value);
                  setTopicId("_none");
                }}
              >
                <SelectTrigger>
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
              <Label>{isRu ? "Тема" : "Topic"}</Label>
              <Select value={topicId} onValueChange={setTopicId} disabled={courseId === "_none"}>
                <SelectTrigger>
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
              <Label>{isRu ? "Теги через запятую" : "Comma-separated tags"}</Label>
              <Input value={tags} onChange={(event) => setTags(event.target.value)} />
            </div>

            <div className="rounded-md border border-border bg-background p-3 text-xs">
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <dt className="text-muted-foreground">{isRu ? "Файл" : "File"}</dt>
                <dd className="truncate">{prepared.fileName}</dd>
                <dt className="text-muted-foreground">{isRu ? "Язык" : "Language"}</dt>
                <dd>{prepared.extraction.sourceLanguage || "—"}</dd>
                <dt className="text-muted-foreground">{isRu ? "Слов" : "Words"}</dt>
                <dd>{prepared.extraction.wordCount ?? 0}</dd>
                <dt className="text-muted-foreground">{isRu ? "Страниц" : "Pages"}</dt>
                <dd>{prepared.extraction.pageCount ?? "—"}</dd>
              </dl>
            </div>

            {warning && (
              <div className="flex gap-2 rounded-md border border-yellow-500/25 bg-yellow-500/5 p-3 text-xs text-yellow-100">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{warning}</span>
              </div>
            )}
          </div>

          <div className="min-w-0">
            <Label className="mb-2 flex items-center gap-1.5">
              {prepared.isVisualSource ? (
                <FileImage className="h-4 w-4" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              {prepared.isVisualSource
                ? isRu
                  ? "Исходная фотография"
                  : "Source image"
                : isRu
                  ? "Извлечённый текст"
                  : "Extracted text"}
            </Label>
            {prepared.isVisualSource ? (
              previewUrl ? (
                <div className="flex min-h-[430px] items-center justify-center overflow-hidden rounded-md border border-input bg-background p-3">
                  <img
                    src={previewUrl}
                    alt={prepared.fileName}
                    className="max-h-[65svh] max-w-full object-contain"
                  />
                </div>
              ) : (
                <div className="flex min-h-[430px] items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
                  {isRu ? "Предпросмотр недоступен" : "Preview unavailable"}
                </div>
              )
            ) : (
              <textarea
                readOnly
                dir="auto"
                className="min-h-[430px] w-full resize-y rounded-md border border-input bg-background p-3 font-mono text-sm leading-relaxed"
                value={prepared.extraction.rawText}
                placeholder={isRu ? "Текст не извлечён" : "No text was extracted"}
              />
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                onRetry();
                onOpenChange(false);
              }}
            >
              <RotateCcw className="h-4 w-4 me-1" />
              {isRu ? "Обработать заново" : "Retry processing"}
            </Button>
            <Button
              variant="ghost"
              className="text-destructive"
              onClick={() => {
                onDiscard();
                onOpenChange(false);
              }}
            >
              <Trash2 className="h-4 w-4 me-1" />
              {isRu ? "Отбросить" : "Discard"}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                onSave(patch(true));
                onOpenChange(false);
              }}
            >
              {isRu ? "Сохранить без курса" : "Save without course"}
            </Button>
            <Button
              onClick={() => {
                onSave(patch(false));
                onOpenChange(false);
              }}
            >
              {prepared.isVisualSource
                ? isRu
                  ? "Сохранить и перейти к OCR"
                  : "Save for OCR"
                : isRu
                  ? "Сохранить"
                  : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function warningCopy(status: string, isRu: boolean, isVisualSource: boolean): string | undefined {
  if (isVisualSource && status === "no_text") {
    return isRu
      ? "Фото будет храниться локально в этом браузере. OCR создаст отдельный редактируемый черновик; распознавание не считается подтверждённым, пока ты его не применишь."
      : "The photo will be stored locally in this browser. OCR creates a separate editable draft; recognition is not trusted until you apply it.";
  }
  switch (status) {
    case "partial":
      return isRu
        ? "Текст извлечён частично. Проверь пропуски перед сохранением."
        : "Text extraction is partial. Check for missing content before saving.";
    case "unsupported":
      return isRu
        ? "Формат не поддерживается полностью. Можно сохранить запись, но AI не получит содержимое."
        : "This format is not fully supported. You may save the record, but AI will not receive its content.";
    case "no_text":
      return isRu
        ? "В файле не найден текст. Может потребоваться OCR."
        : "No text was found. OCR may be required.";
    case "error":
      return isRu
        ? "Во время обработки произошла ошибка. Сохраняй только если запись всё равно нужна."
        : "Processing failed. Save only if you still need the source record.";
    default:
      return undefined;
  }
}

function materialTypeCopy(type: MaterialType, isRu: boolean): string {
  const copy: Record<MaterialType, [string, string]> = {
    syllabus: ["Силлабус", "Syllabus"],
    lecture: ["Лекция", "Lecture"],
    article: ["Статья", "Article"],
    assignment: ["Задание", "Assignment"],
    presentation: ["Презентация", "Presentation"],
    exam: ["Экзамен", "Exam"],
    other: ["Другое", "Other"],
  };
  return copy[type][isRu ? 0 : 1];
}
