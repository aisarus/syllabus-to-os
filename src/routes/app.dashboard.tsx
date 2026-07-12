import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, ArrowUpRight, CalendarDays, Sparkles } from "lucide-react";
import { CourseBook, WoodenShelf, PaperPanel } from "@/components/study-room-ui";
import { useData } from "@/lib/store";
import { useApp } from "@/lib/app-context";

export const Route = createFileRoute("/app/dashboard")({
  component: Dashboard,
});

const fallbackCourses = [
  {
    id: "soc",
    code: "SOC101",
    title: "Introduction to Sociology",
    progress: 72,
    tone: "forest" as const,
  },
  { id: "gov", code: "GOV202", title: "Government in Israel", progress: 54, tone: "rust" as const },
  { id: "heb", code: "HEB110", title: "Academic Hebrew", progress: 81, tone: "ochre" as const },
];

function greetingKey(hour: number) {
  if (hour < 5) return "dashGreetingNight" as const;
  if (hour < 12) return "dashGreetingMorning" as const;
  if (hour < 18) return "dashGreetingAfternoon" as const;
  return "dashGreetingEvening" as const;
}

function Dashboard() {
  const data = useData();
  const { t, lang } = useApp();
  const now = new Date();
  const greeting = t[greetingKey(now.getHours())];
  const todayStr = now.toLocaleDateString(lang === "ru" ? "ru-RU" : "en-GB", {
    day: "numeric",
    month: "long",
  });
  const courses = data.courses.length
    ? data.courses.slice(0, 3).map((course, index) => ({
        id: course.id,
        code: course.number || ["SOC101", "GOV202", "HEB110"][index] || "COURSE",
        title: course.title,
        progress: [72, 54, 81][index] || 60,
        tone: (["forest", "rust", "ochre"] as const)[index % 3],
      }))
    : fallbackCourses;

  return (
    <div className="dashboard-room">
      <section className="dashboard-scene" aria-labelledby="dashboard-title">
        <div className="dashboard-scene__top-shelf" aria-hidden="true" />
        <div className="dashboard-scene__lamp-glow" aria-hidden="true" />
        <div className="dashboard-scene__ivy dashboard-scene__ivy--left" aria-hidden="true" />
        <div className="dashboard-scene__ivy dashboard-scene__ivy--right" aria-hidden="true" />

        <div className="dashboard-copy">
          <p className="room-eyebrow">
            <Sparkles size={12} /> {t.dashRoomEyebrow}
          </p>
          <h1 id="dashboard-title">
            {greeting}
            <br />
            {t.dashGreetingTail}
          </h1>
          <p>{t.dashSubtitle}</p>
          <label className="library-search">
            <Search size={17} />
            <input aria-label={t.searchLibraryAria} placeholder={t.searchLibraryPlaceholder} />
            <kbd>⌘ K</kbd>
          </label>
        </div>

        <PaperPanel pinned className="today-note">
          <div className="today-note__heading">
            <span>
              <CalendarDays size={14} /> {t.todayLabel}
            </span>
            <strong>{todayStr}</strong>
          </div>
          <ol>
            <li>
              <time>11:30</time>
              <span>
                <strong>Academic Hebrew</strong>
                <small>Room 204 · 90 min</small>
              </span>
            </li>
            <li>
              <time>15:00</time>
              <span>
                <strong>Review Sociology</strong>
                <small>24 flashcards</small>
              </span>
            </li>
            <li>
              <time>19:30</time>
              <span>
                <strong>Government Essay</strong>
                <small>Outline only</small>
              </span>
            </li>
          </ol>
          <Link to="/app/calendar">
            {t.openCalendar} <ArrowUpRight size={13} />
          </Link>
        </PaperPanel>

        <div className="continue-block">
          <div className="continue-block__label">
            <span>{t.continueStudying}</span>
            <Link to="/app/courses">
              {t.viewAllCourses} <ArrowUpRight size={12} />
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
                <span>◌</span>
                <strong style={{ whiteSpace: "pre-line" }}>{t.viewAllCoursesShort}</strong>
                <ArrowUpRight size={13} />
              </Link>
            </div>
          </WoodenShelf>
        </div>

        <div className="dashboard-scene__desk" aria-hidden="true" />
      </section>

      <section className="desk-shortcuts" aria-label={t.studyToolsAria}>
        <Link to="/app/materials">
          <span>01</span>
          <strong>{t.materials}</strong>
          <small>{t.shortcutOpenArchive}</small>
        </Link>
        <Link to="/app/notes">
          <span>02</span>
          <strong>{t.notes}</strong>
          <small>{t.shortcutContinueWriting}</small>
        </Link>
        <Link to="/app/flashcards">
          <span>03</span>
          <strong>{t.flashcards}</strong>
          <small>{t.shortcutReviewDeck}</small>
        </Link>
        <Link to="/app/study-session">
          <span>04</span>
          <strong>{t.focusSession}</strong>
          <small>{t.shortcutStart45}</small>
        </Link>
      </section>
    </div>
  );
}
