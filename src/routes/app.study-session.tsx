import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check, Music2, RotateCcw, Pause, Play, Square } from "lucide-react";
import { RoomHeading, PaperButton } from "@/components/study-room-ui";

export const Route = createFileRoute("/app/study-session")({
  component: StudySessionPage,
});

function StudySessionPage() {
  const totalSeconds = 45 * 60;
  const [seconds, setSeconds] = useState(totalSeconds);
  const [running, setRunning] = useState(false);
  const [sound, setSound] = useState("Rain");

  useEffect(() => {
    if (!running || seconds <= 0) return;
    const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [running, seconds]);

  const time = useMemo(() => {
    const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
    const rest = (seconds % 60).toString().padStart(2, "0");
    return `${minutes}:${rest}`;
  }, [seconds]);

  const progress = ((totalSeconds - seconds) / totalSeconds) * 360;

  return (
    <div className="room-page focus-room">
      <RoomHeading
        eyebrow="A protected hour"
        title="Study session"
        subtitle="One course, one goal, one quiet stretch of time."
        actions={<PaperButton><Music2 size={14} /> Ambient sounds</PaperButton>}
      />

      <section className="focus-desk">
        <aside className="focus-card focus-card--course">
          <span>CURRENT SESSION</span>
          <h2>Introduction to Sociology</h2>
          <p>Reading: Durkheim · Social facts</p>
          <button type="button">Change course</button>
        </aside>

        <aside className="focus-card focus-card--goals">
          <span>TODAY&apos;S GOAL</span>
          <label><input type="checkbox" defaultChecked /><i><Check size={12} /></i> Read 20 pages</label>
          <label><input type="checkbox" /><i><Check size={12} /></i> Take notes</label>
          <label><input type="checkbox" /><i><Check size={12} /></i> 10 flashcards</label>
          <label><input type="checkbox" /><i><Check size={12} /></i> Mini quiz</label>
        </aside>

        <div
          className={running ? "mechanical-timer is-running" : "mechanical-timer"}
          style={{ "--timer-angle": `${progress}deg` } as React.CSSProperties}
        >
          <div className="mechanical-timer__ticks" aria-hidden="true" />
          <div className="mechanical-timer__face">
            <span>FOCUS TIME</span>
            <strong>{time}</strong>
            <small>{running ? "Stay with the page" : "Ready when you are"}</small>
            <button type="button" onClick={() => setRunning((value) => !value)}>
              {running ? <Pause size={15} /> : <Play size={15} />}
              {running ? "Pause" : "Start"}
            </button>
          </div>
        </div>

        <aside className="focus-card focus-card--sounds">
          <span>AMBIENT SOUNDS</span>
          {[
            ["Rain", "soft window rain"],
            ["Cafe", "quiet room tone"],
            ["Fireplace", "low warm crackle"],
            ["Forest", "leaves and birds"],
          ].map(([name, description]) => (
            <button key={name} type="button" className={sound === name ? "is-active" : ""} onClick={() => setSound(name)}>
              <span>{name}</span><small>{description}</small>
            </button>
          ))}
          <input type="range" min="0" max="100" defaultValue="48" aria-label="Ambient sound volume" />
        </aside>

        <div className="focus-controls">
          <button type="button" onClick={() => setRunning((value) => !value)}>{running ? <Pause size={16} /> : <Play size={16} />}{running ? "Pause" : "Start"}</button>
          <button type="button" onClick={() => { setRunning(false); setSeconds(totalSeconds); }}><RotateCcw size={16} />Reset</button>
          <button type="button" onClick={() => { setRunning(false); setSeconds(0); }}><Square size={15} />Finish</button>
        </div>

        <div className="focus-desk__props" aria-hidden="true" />
      </section>
    </div>
  );
}
