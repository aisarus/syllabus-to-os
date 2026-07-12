import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, ArrowUpRight, CalendarDays, Sparkles } from "lucide-react";
import { CourseBook, WoodenShelf, PaperPanel } from "@/components/study-room-ui";
import { useData } from "@/lib/store";

export const Route = createFileRoute("/app/dashboard")({
  component: Dashboard,
});

const fallbackCourses = [
  { id: "soc", code: "SOC101", title: "Introduction to Sociology", progress: 72, tone: "forest" as const },
  { id: "gov", code: "GOV202", title: "Government in Israel", progress: 54, tone: "rust" as const },
  { id: "heb", code: "HEB110", title: "Academic Hebrew", progress: 81, tone: "ochre" as const },
];

function Dashboard() {
  const data = useData();
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
          <p className="room-eyebrow"><Sparkles size={12} /> Sunday study room</p>
          <h1 id="dashboard-title">Good evening,<br />let&apos;s continue your journey.</h1>
          <p>Focus, learn, and grow — one page at a time.</p>
          <label className="library-search">
            <Search size={17} />
            <input aria-label="Search your library" placeholder="Search your library…" />
            <kbd>⌘ K</kbd>
          </label>
        </div>

        <PaperPanel pinned className="today-note">
          <div className="today-note__heading">
            <span><CalendarDays size={14} /> Today</span>
            <strong>12 July</strong>
          </div>
          <ol>
            <li><time>11:30</time><span><strong>Academic Hebrew</strong><small>Room 204 · 90 min</small></span></li>
            <li><time>15:00</time><span><strong>Review Sociology</strong><small>24 flashcards</small></span></li>
            <li><time>19:30</time><span><strong>Government Essay</strong><small>Outline only</small></span></li>
          </ol>
          <Link to="/app/calendar">Open calendar <ArrowUpRight size={13} /></Link>
        </PaperPanel>

        <div className="continue-block">
          <div className="continue-block__label">
            <span>Continue studying</span>
            <Link to="/app/courses">View all courses <ArrowUpRight size={12} /></Link>
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
                <strong>View all<br />courses</strong>
                <ArrowUpRight size={13} />
              </Link>
            </div>
          </WoodenShelf>
        </div>

        <div className="dashboard-scene__desk" aria-hidden="true" />
      </section>

      <section className="desk-shortcuts" aria-label="Study tools">
        <Link to="/app/materials"><span>01</span><strong>Materials</strong><small>Open the archive</small></Link>
        <Link to="/app/notes"><span>02</span><strong>Notes</strong><small>Continue writing</small></Link>
        <Link to="/app/flashcards"><span>03</span><strong>Flashcards</strong><small>Review a deck</small></Link>
        <Link to="/app/study-session"><span>04</span><strong>Focus session</strong><small>Start 45 minutes</small></Link>
      </section>
    </div>
  );
}
