import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState, type DragEvent } from "react";
import {
  ArrowUpRight,
  CircleHelp,
  FileInput,
  FileText,
  FileUp,
  FolderOpen,
  Layers3,
  NotebookPen,
} from "lucide-react";
import { toast } from "sonner";
import { AIGenerateButton } from "@/components/ai-generate-dialog";
import { useApp } from "@/lib/app-context";
import { intakeFile } from "@/lib/material-intake";
import { useData } from "@/lib/store";

export const Route = createFileRoute("/app/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const data = useData();
  const { lang } = useApp();
  const isRu = lang === "ru";
  const now = new Date();
  const hour = now.getHours();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  const greeting = isRu
    ? hour < 6
      ? "Доброй ночи."
      : hour < 12
        ? "Доброе утро."
        : hour < 18
          ? "Добрый день."
          : "Добрый вечер."
    : hour < 6
      ? "Good night."
      : hour < 12
        ? "Good morning."
        : hour < 18
          ? "Good afternoon."
          : "Good evening.";

  const copy = isRu
    ? {
        eyebrow: "Рабочее пространство контента",
        subtitle: "Загружай учебные материалы и превращай их в понятные конспекты, карточки и тесты.",
        date: new Intl.DateTimeFormat("ru-RU", {
          day: "numeric",
          month: "long",
          weekday: "long",
        }).format(now),
        intakeLabel: "Единый вход",
        intakeTitle: "Добавь любой учебный материал",
        intakeBody:
          "Силлабус, PDF, документ, таблица или текст попадут в общую библиотеку. Lamdan извлечёт содержимое и подготовит его для дальнейшей генерации.",
        chooseFile: "Выбрать файл",
        importing: "Обрабатываю…",
        importSyllabus: "Импортировать силлабус",
        aiLabel: "AI-преобразование",
        aiTitle: "Создай результат из материала",
        aiBody: "Выбери источник, проверь черновик и сохрани его в библиотеку.",
        note: "Создать конспект",
        cards: "Создать карточки",
        quiz: "Создать тест",
        recent: "Последние материалы",
        allMaterials: "Все материалы",
        noMaterials: "Материалов пока нет. Загрузи первый файл выше.",
        courses: "Курсы",
        allCourses: "Все курсы",
        noCourses: "Курсов пока нет. Начни с импорта силлабуса.",
        files: "мат.",
        notes: "консп.",
        cardCount: "карт.",
        library: "Библиотека",
        materials: "Материалы",
        quizzes: "Тесты",
        open: "Открыть",
        uploadSuccess: "Материал добавлен",
        uploadPartial: "Материал добавлен, но извлечение текста выполнено не полностью",
        uploadError: "Материал сохранён с ошибкой обработки",
      }
    : {
        eyebrow: "Content workspace",
        subtitle: "Upload study materials and turn them into clear notes, flashcards and quizzes.",
        date: new Intl.DateTimeFormat("en-GB", {
          day: "numeric",
          month: "long",
          weekday: "long",
        }).format(now),
        intakeLabel: "Universal intake",
        intakeTitle: "Add any study material",
        intakeBody:
          "A syllabus, PDF, document, spreadsheet or pasted text enters one library. Lamdan extracts the content and prepares it for generation.",
        chooseFile: "Choose file",
        importing: "Processing…",
        importSyllabus: "Import syllabus",
        aiLabel: "AI transformation",
        aiTitle: "Create an output from a material",
        aiBody: "Choose a source, review the draft and save it to your library.",
        note: "Create note",
        cards: "Create flashcards",
        quiz: "Create quiz",
        recent: "Recent materials",
        allMaterials: "All materials",
        noMaterials: "No materials yet. Upload the first file above.",
        courses: "Courses",
        allCourses: "All courses",
        noCourses: "No courses yet. Start by importing a syllabus.",
        files: "files",
        notes: "notes",
        cardCount: "cards",
        library: "Library",
        materials: "Materials",
        quizzes: "Quizzes",
        open: "Open",
        uploadSuccess: "Material added",
        uploadPartial: "Material added, but text extraction was incomplete",
        uploadError: "Material saved with a processing error",
      };

  const recentMaterials = [...data.materials]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 5);
  const courses = [...data.courses].sort((a, b) => a.order - b.order).slice(0, 4);

  const upload = async (file?: File) => {
    if (!file || uploading) return;
    setUploading(true);
    try {
      const result = await intakeFile(file);
      if (result.outcome === "success") {
        toast.success(copy.uploadSuccess);
      } else if (result.outcome === "partial") {
        toast.warning(result.message || copy.uploadPartial);
      } else {
        toast.error(result.message || copy.uploadError);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.uploadError);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    void upload(event.dataTransfer.files?.[0]);
  };

  return (
    <div className="cw-dashboard">
      <header className="cw-dashboard__topbar">
        <div>
          <div className="cw-eyebrow">{copy.eyebrow}</div>
          <h1>{greeting}</h1>
          <p className="cw-dashboard__subtitle">{copy.subtitle}</p>
        </div>
        <time className="cw-date">{copy.date}</time>
      </header>

      <section className="cw-dashboard__hero-grid">
        <div
          className="cw-panel cw-intake"
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          data-dragging={dragging || undefined}
        >
          <div className="cw-section-label">{copy.intakeLabel}</div>
          <h2>{copy.intakeTitle}</h2>
          <p>{copy.intakeBody}</p>
          <div className="cw-intake__actions">
            <input
              ref={fileInput}
              type="file"
              hidden
              accept=".pdf,.docx,.xlsx,.xls,.txt,.md,.csv,.json,.html,.xml,.yaml,.yml"
              onChange={(event) => void upload(event.target.files?.[0])}
            />
            <button
              type="button"
              className="cw-action"
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
            >
              <FileUp size={17} />
              {uploading ? copy.importing : copy.chooseFile}
            </button>
            <Link to="/app/import-syllabus" className="cw-action-secondary">
              <FileInput size={17} />
              {copy.importSyllabus}
            </Link>
          </div>
        </div>

        <aside className="cw-panel cw-ai-panel">
          <div className="cw-section-label">{copy.aiLabel}</div>
          <h2>{copy.aiTitle}</h2>
          <p>{copy.aiBody}</p>
          <div className="cw-ai-actions">
            <AIGenerateButton kind="note" label={copy.note} />
            <AIGenerateButton kind="flashcards" label={copy.cards} />
            <AIGenerateButton kind="quiz" label={copy.quiz} />
          </div>
        </aside>
      </section>

      <section className="cw-dashboard__content-grid">
        <div className="cw-panel cw-section">
          <div className="cw-section__header">
            <h2>{copy.recent}</h2>
            <Link to="/app/materials" className="cw-text-link">
              {copy.allMaterials} <ArrowUpRight size={13} />
            </Link>
          </div>
          {recentMaterials.length === 0 ? (
            <div className="cw-empty">{copy.noMaterials}</div>
          ) : (
            <div className="cw-list">
              {recentMaterials.map((material) => {
                const course = data.courses.find((item) => item.id === material.courseId);
                return (
                  <Link
                    key={material.id}
                    to="/app/materials/$materialId"
                    params={{ materialId: material.id }}
                    className="cw-list-row"
                  >
                    <span className="cw-list-row__icon">
                      <FileText size={15} />
                    </span>
                    <span>
                      <strong>{material.title}</strong>
                      <small>
                        {[course?.title, material.fileName, material.sourceLanguage]
                          .filter(Boolean)
                          .join(" · ")}
                      </small>
                    </span>
                    <span className="cw-list-row__meta">{material.type}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="cw-panel cw-section">
          <div className="cw-section__header">
            <h2>{copy.courses}</h2>
            <Link to="/app/courses" className="cw-text-link">
              {copy.allCourses} <ArrowUpRight size={13} />
            </Link>
          </div>
          {courses.length === 0 ? (
            <div className="cw-empty">{copy.noCourses}</div>
          ) : (
            <div className="cw-course-grid">
              {courses.map((course) => {
                const materialCount = data.materials.filter((item) => item.courseId === course.id).length;
                const noteCount = data.notes.filter((item) => item.courseId === course.id).length;
                const cardCount = data.flashcards.filter((item) => item.courseId === course.id).length;
                return (
                  <Link
                    key={course.id}
                    to="/app/courses/$courseId"
                    params={{ courseId: course.id }}
                    className="cw-course-card"
                  >
                    <span className="cw-course-card__code">{course.number || "COURSE"}</span>
                    <h3>{course.title}</h3>
                    <span className="cw-course-card__counts">
                      <span>{materialCount} {copy.files}</span>
                      <span>{noteCount} {copy.notes}</span>
                      <span>{cardCount} {copy.cardCount}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section aria-label={copy.library} className="cw-library-strip">
        <Link to="/app/materials" className="cw-library-link">
          <FolderOpen size={24} />
          <span>
            <strong>{copy.materials}</strong>
            <small>{data.materials.length} · {copy.open}</small>
          </span>
        </Link>
        <Link to="/app/notes" className="cw-library-link">
          <NotebookPen size={24} />
          <span>
            <strong>{copy.note.replace(/^Создать |^Create /, "")}</strong>
            <small>{data.notes.length} · {copy.open}</small>
          </span>
        </Link>
        <Link to="/app/flashcards" className="cw-library-link">
          <Layers3 size={24} />
          <span>
            <strong>{copy.cards.replace(/^Создать |^Create /, "")}</strong>
            <small>{data.flashcards.length} · {copy.open}</small>
          </span>
        </Link>
        <Link to="/app/quizzes" className="cw-library-link">
          <CircleHelp size={24} />
          <span>
            <strong>{copy.quizzes}</strong>
            <small>{data.quizzes.length} · {copy.open}</small>
          </span>
        </Link>
      </section>
    </div>
  );
}
