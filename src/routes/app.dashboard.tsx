import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState, type DragEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  FileInput,
  FileText,
  FileUp,
  FolderOpen,
  Layers3,
  NotebookPen,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { AIGenerateButton } from "@/components/ai-generate-dialog";
import { useMaterialIntakeQueue } from "@/components/material-intake-queue";
import { useApp } from "@/lib/app-context";
import {
  buildStudyCommandCenter,
  buildStudyPlan,
  type StudyAction,
  type StudyRisk,
} from "@/lib/study-command-center";
import { useData } from "@/lib/store";
import "@/study-command-center.css";
import "@/study-desk-dashboard.css";

export const Route = createFileRoute("/app/dashboard")({
  component: Dashboard,
});

function ActionLink({
  action,
  className,
  children,
}: {
  action: StudyAction;
  className: string;
  children: ReactNode;
}) {
  if (
    (action.kind === "review_material" || action.kind === "build_study_pack") &&
    action.materialId
  ) {
    return (
      <Link
        to="/app/materials/$materialId"
        params={{ materialId: action.materialId }}
        className={className}
      >
        {children}
      </Link>
    );
  }
  if (action.kind === "practice_quiz" && action.quizId) {
    return (
      <Link to="/app/quizzes/$quizId" params={{ quizId: action.quizId }} className={className}>
        {children}
      </Link>
    );
  }
  if ((action.kind === "continue_course" || action.kind === "prepare_exam") && action.courseId) {
    return (
      <Link
        to="/app/courses/$courseId"
        params={{ courseId: action.courseId }}
        className={className}
      >
        {children}
      </Link>
    );
  }
  if (action.kind === "assignment") {
    return (
      <Link to="/app/assignments" className={className}>
        {children}
      </Link>
    );
  }
  if (action.kind === "review_cards") {
    return (
      <Link to="/app/flashcards" className={className}>
        {children}
      </Link>
    );
  }
  return (
    <Link to="/app/materials" className={className}>
      {children}
    </Link>
  );
}

function RiskLink({ risk, children }: { risk: StudyRisk; children: ReactNode }) {
  if (risk.materialId) {
    return (
      <Link
        to="/app/materials/$materialId"
        params={{ materialId: risk.materialId }}
        className="cw-command-row__link"
      >
        {children}
      </Link>
    );
  }
  if (risk.courseId) {
    return (
      <Link
        to="/app/courses/$courseId"
        params={{ courseId: risk.courseId }}
        className="cw-command-row__link"
      >
        {children}
      </Link>
    );
  }
  return <span>{children}</span>;
}

function Dashboard() {
  const data = useData();
  const { lang } = useApp();
  const { enqueueFiles } = useMaterialIntakeQueue();
  const isRu = lang === "ru";
  const now = new Date();
  const hour = now.getHours();
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [studyBudget, setStudyBudget] = useState<20 | 45 | 90>(45);

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
        eyebrow: "Учебный стол",
        subtitle: "Продолжи с нужного места или положи на стол новый источник.",
        date: new Intl.DateTimeFormat("ru-RU", {
          day: "numeric",
          month: "long",
          weekday: "long",
        }).format(now),
        focusLabel: "Продолжить работу",
        focusBody: "Lamdan выбрал действие из реальных материалов, дедлайнов и повторений.",
        mainTask: "Следующий шаг",
        openTask: "Открыть",
        commandLabel: "Академический автопилот",
        commandTitle: "План и риски",
        commandBody:
          "Дополнительный слой для тех случаев, когда нужен порядок действий, а не ещё одна панель статистики.",
        honestData: "Только реальные данные",
        plan: "План сессии",
        quickWins: "Короткие действия",
        risks: "Требует внимания",
        noQuickWins: "Отдельных коротких действий сейчас нет.",
        noRisks: "Критических рисков по имеющимся данным не найдено.",
        minutes: "мин",
        metricCards: "карточек ждут повторения",
        metricAssignments: "открытых заданий",
        metricReview: "источников требуют проверки",
        intakeLabel: "Новый источник",
        intakeTitle: "Добавь материал",
        intakeBody:
          "Перетащи сюда PDF, документ, таблицу или фотографии. Очередь обработает файлы, не прерывая работу.",
        chooseFiles: "Выбрать файлы",
        importSyllabus: "Импортировать силлабус",
        aiLabel: "Из материала — в учебный инструмент",
        aiTitle: "Подготовить конспект, карточки или тест",
        aiBody:
          "Сначала выбирается источник, затем ты проверяешь черновик и только потом сохраняешь.",
        note: "Создать конспект",
        cards: "Создать карточки",
        quiz: "Создать тест",
        recent: "Недавние материалы",
        allMaterials: "Вся библиотека",
        noMaterials: "На столе пока пусто. Добавь первый файл или фотографию.",
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
        courseWithoutCode: "БЕЗ КОДА",
        expandAutopilot: "Открыть дополнительный план",
      }
    : {
        eyebrow: "Study desk",
        subtitle: "Continue where it matters or place a new source on the desk.",
        date: new Intl.DateTimeFormat("en-GB", {
          day: "numeric",
          month: "long",
          weekday: "long",
        }).format(now),
        focusLabel: "Continue working",
        focusBody: "Lamdan selected an action from real sources, deadlines and reviews.",
        mainTask: "Next step",
        openTask: "Open",
        commandLabel: "Academic autopilot",
        commandTitle: "Plan and risks",
        commandBody:
          "A secondary layer for moments when you need an order of work, not another statistics dashboard.",
        honestData: "Real data only",
        plan: "Study session plan",
        quickWins: "Short actions",
        risks: "Needs attention",
        noQuickWins: "There are no separate short actions right now.",
        noRisks: "No critical risk is visible in the available data.",
        minutes: "min",
        metricCards: "cards waiting for review",
        metricAssignments: "open assignments",
        metricReview: "sources need review",
        intakeLabel: "New source",
        intakeTitle: "Add material",
        intakeBody:
          "Drop PDFs, documents, spreadsheets or photos here. The queue processes them without interrupting your work.",
        chooseFiles: "Choose files",
        importSyllabus: "Import syllabus",
        aiLabel: "From source to study tool",
        aiTitle: "Prepare a note, flashcards or quiz",
        aiBody: "Choose a source, review the draft and only then save it.",
        note: "Create note",
        cards: "Create flashcards",
        quiz: "Create quiz",
        recent: "Recent materials",
        allMaterials: "Full library",
        noMaterials: "The desk is empty. Add your first file or photo.",
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
        courseWithoutCode: "NO CODE",
        expandAutopilot: "Open the additional plan",
      };

  const commandCenter = buildStudyCommandCenter(data, {
    now: now.getTime(),
    locale: isRu ? "ru" : "en",
  });
  const plan = buildStudyPlan(commandCenter.actions, studyBudget);
  const quickWins = commandCenter.quickWins.filter(
    (action) => action.id !== commandCenter.focus.id,
  );
  const recentMaterials = [...data.materials].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);
  const courses = [...data.courses].sort((a, b) => a.order - b.order).slice(0, 4);

  const addFiles = (files?: FileList | null) => {
    if (!files || files.length === 0) return;
    enqueueFiles(files);
    if (fileInput.current) fileInput.current.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    addFiles(event.dataTransfer.files);
  };

  return (
    <div className="cw-dashboard cw-dashboard--study-desk">
      <header className="cw-dashboard__topbar">
        <div>
          <div className="cw-eyebrow">{copy.eyebrow}</div>
          <h1>{greeting}</h1>
          <p className="cw-dashboard__subtitle">{copy.subtitle}</p>
        </div>
        <time className="cw-date">{copy.date}</time>
      </header>

      <section className="cw-study-desk" aria-label={copy.focusLabel}>
        <article className="cw-panel cw-desk-focus">
          <div className="cw-desk-focus__header">
            <div>
              <div className="cw-section-label">{copy.focusLabel}</div>
              <p>{copy.focusBody}</p>
            </div>
            <span className="cw-command-center__honesty">
              <ShieldCheck size={13} />
              {copy.honestData}
            </span>
          </div>

          <div className="cw-focus-card cw-focus-card--desk">
            <span className="cw-focus-card__icon">
              <Target size={25} />
            </span>
            <div>
              <div className="cw-focus-card__meta">
                <span>{copy.mainTask}</span>
              </div>
              <h2>{commandCenter.focus.title}</h2>
              <p>{commandCenter.focus.detail}</p>
            </div>
            <ActionLink action={commandCenter.focus} className="cw-focus-card__action">
              {copy.openTask} <ChevronRight size={16} />
            </ActionLink>
          </div>
        </article>

        <div
          className="cw-panel cw-intake cw-intake--desk"
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
          <span className="cw-intake__seal" aria-hidden="true">
            <FileUp size={24} />
          </span>
          <h2>{copy.intakeTitle}</h2>
          <p>{copy.intakeBody}</p>
          <div className="cw-intake__actions">
            <input
              ref={fileInput}
              type="file"
              multiple
              hidden
              accept=".pdf,.docx,.xlsx,.xls,.txt,.md,.csv,.json,.html,.xml,.yaml,.yml,.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              onChange={(event) => addFiles(event.target.files)}
            />
            <button type="button" className="cw-action" onClick={() => fileInput.current?.click()}>
              <FileUp size={17} />
              {copy.chooseFiles}
            </button>
            <Link to="/app/import-syllabus" className="cw-action-secondary">
              <FileInput size={17} />
              {copy.importSyllabus}
            </Link>
          </div>
        </div>
      </section>

      <section className="cw-dashboard__content-grid cw-dashboard__content-grid--primary">
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
                const materialCount = data.materials.filter(
                  (item) => item.courseId === course.id,
                ).length;
                const noteCount = data.notes.filter((item) => item.courseId === course.id).length;
                const cardCount = data.flashcards.filter(
                  (item) => item.courseId === course.id,
                ).length;
                return (
                  <Link
                    key={course.id}
                    to="/app/courses/$courseId"
                    params={{ courseId: course.id }}
                    className="cw-course-card"
                  >
                    <span className="cw-course-card__code">
                      {course.number || copy.courseWithoutCode}
                    </span>
                    <h3>{course.title}</h3>
                    <span className="cw-course-card__counts">
                      <span>
                        {materialCount} {copy.files}
                      </span>
                      <span>
                        {noteCount} {copy.notes}
                      </span>
                      <span>
                        {cardCount} {copy.cardCount}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="cw-panel cw-ai-panel cw-ai-panel--wide">
        <div>
          <div className="cw-section-label">{copy.aiLabel}</div>
          <h2>{copy.aiTitle}</h2>
          <p>{copy.aiBody}</p>
        </div>
        <div className="cw-ai-actions">
          <AIGenerateButton kind="note" label={copy.note} />
          <AIGenerateButton kind="flashcards" label={copy.cards} />
          <AIGenerateButton kind="quiz" label={copy.quiz} />
        </div>
      </section>

      <section aria-label={copy.library} className="cw-library-strip">
        <Link to="/app/materials" className="cw-library-link">
          <FolderOpen size={24} />
          <span>
            <strong>{copy.materials}</strong>
            <small>
              {data.materials.length} · {copy.open}
            </small>
          </span>
        </Link>
        <Link to="/app/notes" className="cw-library-link">
          <NotebookPen size={24} />
          <span>
            <strong>{copy.note.replace(/^Создать |^Create /, "")}</strong>
            <small>
              {data.notes.length} · {copy.open}
            </small>
          </span>
        </Link>
        <Link to="/app/flashcards" className="cw-library-link">
          <Layers3 size={24} />
          <span>
            <strong>{copy.cards.replace(/^Создать |^Create /, "")}</strong>
            <small>
              {data.flashcards.length} · {copy.open}
            </small>
          </span>
        </Link>
        <Link to="/app/quizzes" className="cw-library-link">
          <CircleHelp size={24} />
          <span>
            <strong>{copy.quizzes}</strong>
            <small>
              {data.quizzes.length} · {copy.open}
            </small>
          </span>
        </Link>
      </section>

      <details className="cw-panel cw-command-center cw-command-center--secondary">
        <summary aria-label={copy.expandAutopilot}>
          <span>
            <span className="cw-section-label">{copy.commandLabel}</span>
            <strong>{copy.commandTitle}</strong>
            <small>{copy.commandBody}</small>
          </span>
          <ChevronDown size={18} aria-hidden="true" />
        </summary>

        <div className="cw-command-center__secondary-body">
          <div className="cw-command-center__grid cw-command-center__grid--secondary">
            <aside className="cw-plan-card">
              <div className="cw-plan-card__top">
                <strong>{copy.plan}</strong>
                <div className="cw-budget-switcher" aria-label={copy.plan}>
                  {([20, 45, 90] as const).map((budget) => (
                    <button
                      key={budget}
                      type="button"
                      data-active={studyBudget === budget}
                      onClick={() => setStudyBudget(budget)}
                    >
                      {budget}
                    </button>
                  ))}
                </div>
              </div>
              <div className="cw-plan-list">
                {plan.map(({ action, allocatedMinutes }) => (
                  <div key={action.id} className="cw-plan-item">
                    <span className="cw-plan-item__minutes">
                      {allocatedMinutes} {copy.minutes}
                    </span>
                    <span>
                      <strong>{action.title}</strong>
                      <small>{action.detail}</small>
                    </span>
                    <ActionLink action={action} className="cw-plan-item__action">
                      <ChevronRight size={14} />
                    </ActionLink>
                  </div>
                ))}
              </div>
            </aside>

            <div className="cw-command-center__lower cw-command-center__lower--stacked">
              <div className="cw-command-list">
                <div className="cw-command-list__header">
                  <Sparkles size={15} /> {copy.quickWins}
                </div>
                {quickWins.length === 0 ? (
                  <div className="cw-command-empty">{copy.noQuickWins}</div>
                ) : (
                  quickWins.map((action) => (
                    <div key={action.id} className="cw-command-row">
                      <span>
                        <ActionLink action={action} className="cw-command-row__link">
                          <strong>{action.title}</strong>
                        </ActionLink>
                        <small>{action.detail}</small>
                      </span>
                      <span className="cw-command-row__time">
                        {action.durationMinutes} {copy.minutes}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div className="cw-command-list">
                <div className="cw-command-list__header">
                  <AlertTriangle size={15} /> {copy.risks}
                </div>
                {commandCenter.risks.length === 0 ? (
                  <div className="cw-command-empty">
                    <CheckCircle2 size={15} />
                    &nbsp; {copy.noRisks}
                  </div>
                ) : (
                  commandCenter.risks.map((risk) => (
                    <div key={risk.id} className="cw-command-row">
                      <RiskLink risk={risk}>
                        <strong>{risk.title}</strong>
                        <small>{risk.detail}</small>
                      </RiskLink>
                      <span className="cw-command-row__time">{risk.urgency}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="cw-command-metrics cw-command-metrics--quiet">
            <div className="cw-command-metric">
              <strong>{commandCenter.metrics.dueCards}</strong>
              <span>{copy.metricCards}</span>
            </div>
            <div className="cw-command-metric">
              <strong>{commandCenter.metrics.openAssignments}</strong>
              <span>{copy.metricAssignments}</span>
            </div>
            <div className="cw-command-metric">
              <strong>{commandCenter.metrics.materialsNeedingReview}</strong>
              <span>{copy.metricReview}</span>
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}
