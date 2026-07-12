import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { RoomHeading, PaperButton } from "@/components/study-room-ui";
import { useApp } from "@/lib/app-context";

export const Route = createFileRoute("/app/calendar")({
  component: CalendarPage,
});

const events = [
  { day: 1, row: 1, title: "Academic Hebrew", meta: "Room 204", tone: "ochre" },
  { day: 2, row: 1, title: "Sociology Lecture", meta: "Room 105", tone: "rust" },
  { day: 4, row: 1, title: "English Academic", meta: "Library", tone: "moss" },
  { day: 1, row: 3, title: "Statistics Practice", meta: "Lab 6", tone: "forest" },
  { day: 3, row: 2, title: "Economics Principles", meta: "Room 301", tone: "wine" },
  { day: 5, row: 4, title: "Government Essay", meta: "Online", tone: "rust" },
];

function CalendarPage() {
  const { t, lang } = useApp();
  const days: ReadonlyArray<readonly [string, string]> = [
    [t.weekdayMon, "10"],
    [t.weekdayTue, "11"],
    [t.weekdayWed, "12"],
    [t.weekdayThu, "13"],
    [t.weekdayFri, "14"],
    [t.weekdaySat, "15"],
    [t.weekdaySun, "16"],
  ];
  const now = new Date();
  const monthTitle = now.toLocaleDateString(lang === "ru" ? "ru-RU" : "en-GB", {
    month: "long",
    year: "numeric",
  });
  const shortDate = now
    .toLocaleDateString(lang === "ru" ? "ru-RU" : "en-GB", { day: "numeric", month: "short" })
    .toUpperCase();

  return (
    <div className="room-page calendar-room">
      <RoomHeading
        eyebrow={t.calendarEyebrow}
        title={t.calendar}
        subtitle={t.calendarSubtitle}
        actions={
          <div className="calendar-heading-actions">
            <PaperButton aria-label={t.back}>
              <ChevronLeft size={14} />
            </PaperButton>
            <PaperButton>{t.today}</PaperButton>
            <PaperButton aria-label={t.upcoming}>
              <ChevronRight size={14} />
            </PaperButton>
          </div>
        }
      />

      <section className="calendar-board">
        <div className="calendar-board__top">
          <div>
            <CalendarDays size={15} />
            <strong>{monthTitle}</strong>
          </div>
          <div>
            <button type="button" className="is-active">
              {t.weekViewLabel}
            </button>
            <button type="button">{t.monthViewLabel}</button>
          </div>
        </div>

        <div className="week-grid">
          <div className="week-grid__corner">{t.timeColLabel}</div>
          {days.map(([label, date], index) => (
            <div key={label} className={index === 2 ? "week-day is-today" : "week-day"}>
              <span>{label}</span>
              <strong>{date}</strong>
            </div>
          ))}
          {["09:00", "11:00", "13:00", "15:00", "17:00", "19:00"].map((time, row) => (
            <div key={time} className="week-time" style={{ gridRow: row + 2 }}>
              {time}
            </div>
          ))}
          {Array.from({ length: 42 }).map((_, index) => (
            <div key={index} className="week-cell" />
          ))}
          {events.map((event) => (
            <button
              key={`${event.day}-${event.row}-${event.title}`}
              type="button"
              className={`paper-event paper-event--${event.tone}`}
              style={{ gridColumn: event.day + 2, gridRow: event.row + 2 }}
            >
              <strong>{event.title}</strong>
              <small>{event.meta}</small>
            </button>
          ))}
          <div className="calendar-now" style={{ gridRow: 4 }}>
            <span />
          </div>
        </div>

        <aside className="calendar-quote">
          <span>{shortDate}</span>
          <p>{t.calendarQuote}</p>
        </aside>
        <div className="calendar-board__props" aria-hidden="true" />
      </section>
    </div>
  );
}
