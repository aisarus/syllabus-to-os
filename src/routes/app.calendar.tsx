import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { RoomHeading, PaperButton } from "@/components/study-room-ui";

export const Route = createFileRoute("/app/calendar")({
  component: CalendarPage,
});

const days = [
  ["Mon", "10"], ["Tue", "11"], ["Wed", "12"], ["Thu", "13"], ["Fri", "14"], ["Sat", "15"], ["Sun", "16"],
] as const;

const events = [
  { day: 1, row: 1, title: "Academic Hebrew", meta: "Room 204", tone: "ochre" },
  { day: 2, row: 1, title: "Sociology Lecture", meta: "Room 105", tone: "rust" },
  { day: 4, row: 1, title: "English Academic", meta: "Library", tone: "moss" },
  { day: 1, row: 3, title: "Statistics Practice", meta: "Lab 6", tone: "forest" },
  { day: 3, row: 2, title: "Economics Principles", meta: "Room 301", tone: "wine" },
  { day: 5, row: 4, title: "Government Essay", meta: "Online", tone: "rust" },
];

function CalendarPage() {
  return (
    <div className="room-page calendar-room">
      <RoomHeading
        eyebrow="This week"
        title="Calendar"
        subtitle="A quiet overview of classes, deadlines and study time."
        actions={
          <div className="calendar-heading-actions">
            <PaperButton><ChevronLeft size={14} /></PaperButton>
            <PaperButton>Today</PaperButton>
            <PaperButton><ChevronRight size={14} /></PaperButton>
          </div>
        }
      />

      <section className="calendar-board">
        <div className="calendar-board__top">
          <div><CalendarDays size={15} /><strong>July 2026</strong></div>
          <div><button type="button" className="is-active">Week</button><button type="button">Month</button></div>
        </div>

        <div className="week-grid">
          <div className="week-grid__corner">TIME</div>
          {days.map(([label, date], index) => (
            <div key={label} className={index === 2 ? "week-day is-today" : "week-day"}>
              <span>{label}</span><strong>{date}</strong>
            </div>
          ))}
          {["09:00", "11:00", "13:00", "15:00", "17:00", "19:00"].map((time, row) => (
            <div key={time} className="week-time" style={{ gridRow: row + 2 }}>{time}</div>
          ))}
          {Array.from({ length: 42 }).map((_, index) => <div key={index} className="week-cell" />)}
          {events.map((event) => (
            <button
              key={`${event.day}-${event.row}-${event.title}`}
              type="button"
              className={`paper-event paper-event--${event.tone}`}
              style={{ gridColumn: event.day + 2, gridRow: event.row + 2 }}
            >
              <strong>{event.title}</strong><small>{event.meta}</small>
            </button>
          ))}
          <div className="calendar-now" style={{ gridRow: 4 }}><span /></div>
        </div>

        <aside className="calendar-quote">
          <span>12 JUL</span>
          <p>Discipline is choosing between what you want now and what you want most.</p>
        </aside>
        <div className="calendar-board__props" aria-hidden="true" />
      </section>
    </div>
  );
}
