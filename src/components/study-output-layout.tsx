import { Link } from "@tanstack/react-router";
import {
  BookOpenCheck,
  CheckCircle2,
  CircleHelp,
  Layers3,
  NotebookPen,
  ShieldCheck,
} from "lucide-react";
import type { ReactNode } from "react";
import { useApp } from "@/lib/app-context";
import { useData } from "@/lib/store";
import "@/study-output-system.css";

type StudyOutputKind = "notes" | "flashcards" | "quizzes";

type StudyOutputLayoutProps = {
  current: StudyOutputKind;
  children: ReactNode;
  compact?: boolean;
};

export function StudyOutputLayout({
  current,
  children,
  compact = false,
}: StudyOutputLayoutProps) {
  const { lang } = useApp();
  const data = useData();
  const isRu = lang === "ru";
  const now = Date.now();
  const linkedNotes = data.notes.filter((note) => (note.sourceChunkIds?.length ?? 0) > 0).length;
  const dueCards = data.flashcards.filter((card) => card.dueAt <= now).length;
  const totalQuestions = data.quizQuestions.length;
  const totalAttempts = data.quizAttempts.length;

  const items = [
    {
      id: "notes" as const,
      to: "/app/notes" as const,
      icon: NotebookPen,
      step: isRu ? "Понять" : "Understand",
      title: isRu ? "Конспекты" : "Notes",
      count: data.notes.length,
      detail: isRu
        ? `${linkedNotes} со ссылками на источник`
        : `${linkedNotes} linked to source evidence`,
    },
    {
      id: "flashcards" as const,
      to: "/app/flashcards" as const,
      icon: Layers3,
      step: isRu ? "Вспомнить" : "Recall",
      title: isRu ? "Карточки" : "Flashcards",
      count: data.flashcards.length,
      detail: isRu ? `${dueCards} ждут повторения` : `${dueCards} due for review`,
    },
    {
      id: "quizzes" as const,
      to: "/app/quizzes" as const,
      icon: CircleHelp,
      step: isRu ? "Проверить" : "Test",
      title: isRu ? "Тесты" : "Quizzes",
      count: data.quizzes.length,
      detail: isRu
        ? `${totalQuestions} вопросов · ${totalAttempts} попыток`
        : `${totalQuestions} questions · ${totalAttempts} attempts`,
    },
  ];

  return (
    <div className={`study-output-system${compact ? " study-output-system--compact" : ""}`}>
      <section className="study-output-system__masthead" aria-label={isRu ? "Учебный цикл" : "Study cycle"}>
        <div className="study-output-system__intro">
          <span className="study-output-system__seal" aria-hidden="true">
            <BookOpenCheck size={20} />
          </span>
          <div>
            <div className="study-output-system__eyebrow">
              {isRu ? "Единый учебный цикл" : "One study cycle"}
            </div>
            <strong>{isRu ? "Понять → вспомнить → проверить" : "Understand → recall → test"}</strong>
            {!compact && (
              <p>
                {isRu
                  ? "Конспекты сохраняют понимание, карточки тренируют воспроизведение, а тесты дают проверяемые evidence. Все три формата остаются связанными с исходными материалами."
                  : "Notes preserve understanding, flashcards train recall, and quizzes create verifiable evidence. All three formats stay connected to source material."}
              </p>
            )}
          </div>
        </div>
        <span className="study-output-system__trust">
          <ShieldCheck size={13} />
          {isRu ? "источники и evidence сохранены" : "source links and evidence preserved"}
        </span>
      </section>

      <nav className="study-output-system__nav" aria-label={isRu ? "Учебные форматы" : "Study formats"}>
        {items.map((item, index) => {
          const Icon = item.icon;
          const active = current === item.id;
          return (
            <Link
              key={item.id}
              to={item.to}
              className={`study-output-system__stage${active ? " is-active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <span className="study-output-system__stage-number">{index + 1}</span>
              <span className="study-output-system__stage-icon" aria-hidden="true">
                <Icon size={19} />
              </span>
              <span className="study-output-system__stage-copy">
                <small>{item.step}</small>
                <strong>{item.title}</strong>
                {!compact && <span>{item.detail}</span>}
              </span>
              <span className="study-output-system__stage-count">{item.count}</span>
              {active && (
                <CheckCircle2
                  className="study-output-system__stage-check"
                  size={15}
                  aria-hidden="true"
                />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="study-output-system__body">{children}</div>
    </div>
  );
}
