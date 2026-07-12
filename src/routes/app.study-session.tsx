import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check, Music2, RotateCcw, Pause, Play, Square } from "lucide-react";
import { RoomHeading, PaperButton } from "@/components/study-room-ui";
import { useApp } from "@/lib/app-context";

export const Route = createFileRoute("/app/study-session")({
  component: StudySessionPage,
});

function StudySessionPage() {
  const { t } = useApp();
  const totalSeconds = 45 * 60;
  const [seconds, setSeconds] = useState(totalSeconds);
  const [running, setRunning] = useState(false);
  const sounds = useMemo(
    () => [
      { id: "rain", name: t.soundRain, desc: t.soundRainDesc },
      { id: "cafe", name: t.soundCafe, desc: t.soundCafeDesc },
      { id: "fireplace", name: t.soundFireplace, desc: t.soundFireplaceDesc },
      { id: "forest", name: t.soundForest, desc: t.soundForestDesc },
    ],
    [t],
  );
  const [soundId, setSoundId] = useState("rain");
  const goals = useMemo(
    () => [
      { id: "read", label: "Read 20 pages", checked: true },
      { id: "notes", label: "Take notes", checked: false },
      { id: "cards", label: "10 flashcards", checked: false },
      { id: "quiz", label: "Mini quiz", checked: false },
    ],
    [],
  );

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
        eyebrow={t.focusEyebrow}
        title={t.navStudySession}
        subtitle={t.focusSubtitle}
        actions={<PaperButton><Music2 size={14} /> {t.ambientSounds}</PaperButton>}
      />

      <section className="focus-desk">
        <aside className="focus-card focus-card--course">
          <span>{t.currentSessionLabel}</span>
          <h2>Introduction to Sociology</h2>
          <p>Reading: Durkheim · Social facts</p>
          <button type="button">{t.changeCourse}</button>
        </aside>

        <aside className="focus-card focus-card--goals">
          <span>{t.todaysGoalLabel}</span>
          {goals.map((g) => (
            <label key={g.id}>
              <input type="checkbox" defaultChecked={g.checked} />
              <i><Check size={12} /></i> {g.label}
            </label>
          ))}
        </aside>

        <div
          className={running ? "mechanical-timer is-running" : "mechanical-timer"}
          style={{ "--timer-angle": `${progress}deg` } as React.CSSProperties}
        >
          <div className="mechanical-timer__ticks" aria-hidden="true" />
          <div className="mechanical-timer__face">
            <span>{t.focusTimeLabel}</span>
            <strong>{time}</strong>
            <small>{running ? t.focusRunning : t.focusReady}</small>
            <button type="button" onClick={() => setRunning((value) => !value)}>
              {running ? <Pause size={15} /> : <Play size={15} />}
              {running ? t.pause : t.start}
            </button>
          </div>
        </div>

        <aside className="focus-card focus-card--sounds">
          <span>{t.ambientSounds.toUpperCase()}</span>
          {sounds.map((s) => (
            <button key={s.id} type="button" className={soundId === s.id ? "is-active" : ""} onClick={() => setSoundId(s.id)}>
              <span>{s.name}</span><small>{s.desc}</small>
            </button>
          ))}
          <input type="range" min="0" max="100" defaultValue="48" aria-label={t.soundVolumeAria} />
        </aside>

        <div className="focus-controls">
          <button type="button" onClick={() => setRunning((value) => !value)}>{running ? <Pause size={16} /> : <Play size={16} />}{running ? t.pause : t.start}</button>
          <button type="button" onClick={() => { setRunning(false); setSeconds(totalSeconds); }}><RotateCcw size={16} />{t.reset}</button>
          <button type="button" onClick={() => { setRunning(false); setSeconds(0); }}><Square size={15} />{t.finish}</button>
        </div>

        <div className="focus-desk__props" aria-hidden="true" />
      </section>
    </div>
  );
}
