import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Search,
  ArrowUpRight,
  CalendarDays,
  Sparkles,
  FolderArchive,
  NotebookPen,
  Layers3,
  TimerReset,
  Plus,
} from "lucide-react";
import { CourseBook, WoodenShelf, PaperPanel } from "@/components/study-room-ui";
import { useData } from "@/lib/store";
import { useApp } from "@/lib/app-context";
import { courseTone } from "@/lib/course-tone";


export const Route = createFileRoute("/app/dashboard")({
  component: Dashboard,
});




function Dashboard() {
  const data = useData();
  const { lang } = useApp();
  const isRu = lang === "ru";
  const now = new Date();
  const hour = now.getHours();
  const greeting = isRu
    ? hour < 6
      ? "Доброй ночи,"
      : hour < 12
        ? "Доброе утро,"
        : hour < 18
          ? "Добрый день,"
          : "Добрый вечер,"
    : hour < 6
      ? "Good night,"
      : hour < 12
        ? "Good morning,"
        : hour < 18
          ? "Good afternoon,"
          : "Good evening,";

  const copy = isRu
    ? {
        eyebrow: "Учебная комната",
        journey: "продолжим твой путь.",
        subtitle: "Фокусируйся, учись и развивайся — по одной странице за раз.",
        search: "Поиск по библиотеке…",
        today: "Сегодня",
        date: new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(now),
        openCalendar: "Открыть календарь",
        continue: "Продолжить обучение",
        viewAll: "Все курсы",
        addCourse: "Добавить курс",
        toolsAria: "Учебные инструменты",
        shortcuts: [
          ["Материалы", "Открыть архив"],
          ["Конспекты", "Продолжить запись"],
          ["Карточки", "Повторить колоду"],
          ["Фокус-сессия", "Запустить на 45 мин"],
        ],
        schedule: [
          ["11:30", "Академический иврит", "Аудитория 204 · 90 мин"],
          ["15:00", "Обзор социологии", "24 карточки"],
          ["19:30", "Эссе по государственному управлению", "Онлайн · только черновик"],
        ],
      }
    : {
        eyebrow: "Study room",
        journey: "let’s continue your journey.",
        subtitle: "Focus, learn, and grow — one page at a time.",
        search: "Search your library…",
        today: "Today",
        date: new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long" }).format(now),
        openCalendar: "Open calendar",
        continue: "Continue studying",
        viewAll: "View all courses",
        addCourse: "Add course",
        toolsAria: "Study tools",
        shortcuts: [
          ["Materials", "Open the archive"],
          ["Notes", "Continue writing"],
          ["Flashcards", "Review a deck"],
          ["Focus session", "Start 45 minutes"],
        ],
        schedule: [
          ["11:30", "Academic Hebrew", "Room 204 · 90 min"],
          ["15:00", "Review Sociology", "24 flashcards"],
          ["19:30", "Government Essay", "Online · outline only"],
        ],
      };

  const courses = data.courses.length
    ? data.courses.slice(0, 3).map((course, index) => ({
        id: course.id,
        code: course.number || ["6.15", "1.59", "1.62"][index] || "COURSE",
        title: course.title,
        progress: [72, 54, 81][index] || 60,
        tone: (["forest", "rust", "ochre"] as const)[index % 3],
      }))
    : fallbackCourses[lang];

  const shortcutIcons = [FolderArchive, NotebookPen, Layers3, TimerReset] as const;
  const shortcutRoutes = [
    "/app/materials",
    "/app/notes",
    "/app/flashcards",
    "/app/study-session",
  ] as const;

  return (
    <div className="dashboard-room dashboard-room--immersive">
      <section className="dashboard-scene" aria-labelledby="dashboard-title">
        <div className="dashboard-scene__architectural-frame" aria-hidden="true" />
        <div className="dashboard-scene__top-shelf" aria-hidden="true" />
        <div className="dashboard-scene__lamp-glow" aria-hidden="true" />
        <div className="dashboard-scene__left-lamp" aria-hidden="true" />
        <div className="dashboard-scene__right-lamp" aria-hidden="true" />
        <div className="dashboard-scene__right-props" aria-hidden="true" />
        <div className="dashboard-scene__ivy dashboard-scene__ivy--left" aria-hidden="true" />
        <div className="dashboard-scene__ivy dashboard-scene__ivy--right" aria-hidden="true" />

        <div className="dashboard-copy">
          <p className="room-eyebrow">
            <Sparkles size={12} /> {copy.eyebrow}
          </p>
          <h1 id="dashboard-title">
            {greeting}
            <br />
            {copy.journey}
          </h1>
          <p>{copy.subtitle}</p>
          <label className="library-search">
            <Search size={17} />
            <input aria-label={copy.search} placeholder={copy.search} />
            <kbd>⌘ K</kbd>
          </label>
        </div>

        <PaperPanel pinned className="today-note">
          <div className="today-note__heading">
            <span>
              <CalendarDays size={14} /> {copy.today}
            </span>
            <strong>{copy.date}</strong>
          </div>
          <ol>
            {copy.schedule.map(([time, title, meta]) => (
              <li key={`${time}-${title}`}>
                <time>{time}</time>
                <span>
                  <strong>{title}</strong>
                  <small>{meta}</small>
                </span>
              </li>
            ))}
          </ol>
          <Link to="/app/calendar">
            {copy.openCalendar} <ArrowUpRight size={13} />
          </Link>
        </PaperPanel>

        <div className="continue-block">
          <div className="continue-block__label">
            <span>{copy.continue}</span>
            <Link to="/app/courses">
              {copy.viewAll} <ArrowUpRight size={12} />
            </Link>
          </div>
          <WoodenShelf className="dashboard-bookshelf">
            <div className="dashboard-books">
              {courses.map((course) => (
                <CourseBook
                  key={course.id}
                  code={course.code}
                  title={course.title}
                  progress={course.progress}
                  tone={course.tone}
                  to={data.courses.length ? `/app/courses/${course.id}` : "/app/courses"}
                />
              ))}
              <Link to="/app/courses" className="all-courses-book">
                <span>
                  <Plus size={22} />
                </span>
                <strong>{copy.addCourse}</strong>
                <ArrowUpRight size={13} />
              </Link>
            </div>
          </WoodenShelf>
        </div>

        <div className="dashboard-scene__desk" aria-hidden="true" />

        <nav className="desk-shortcuts" aria-label={copy.toolsAria}>
          {copy.shortcuts.map(([title, subtitle], index) => {
            const Icon = shortcutIcons[index];
            return (
              <Link key={title} to={shortcutRoutes[index]} className="desk-drawer">
                <span className="desk-drawer__number">{String(index + 1).padStart(2, "0")}</span>
                <span className="desk-drawer__copy">
                  <strong>{title}</strong>
                  <small>{subtitle}</small>
                </span>
                <span className="desk-drawer__object" aria-hidden="true">
                  <Icon size={31} strokeWidth={1.2} />
                </span>
                <span className="desk-drawer__handle" aria-hidden="true" />
              </Link>
            );
          })}
        </nav>
      </section>
    </div>
  );
}
