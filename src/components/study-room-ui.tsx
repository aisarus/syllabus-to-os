import type { CSSProperties, ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export type BookTone = "forest" | "rust" | "ochre" | "navy" | "umber" | "moss" | "wine";

const toneMap: Record<BookTone, string> = {
  forest: "course-book--forest",
  rust: "course-book--rust",
  ochre: "course-book--ochre",
  navy: "course-book--navy",
  umber: "course-book--umber",
  moss: "course-book--moss",
  wine: "course-book--wine",
};

export function CourseBook({
  code,
  title,
  progress,
  tone = "forest",
  to = "/app/courses",
  className,
  compact = false,
}: {
  code: string;
  title: string;
  progress: number | null;
  tone?: BookTone;
  to?: string;
  className?: string;
  compact?: boolean;
}) {
  const hasProgress = typeof progress === "number";
  const pct = hasProgress ? progress : 0;
  return (
    <Link
      to={to as never}
      className={cn("course-book", toneMap[tone], compact && "course-book--compact", className)}
      aria-label={hasProgress ? `${title}, ${pct}%` : title}
      style={{ "--book-progress": `${pct}%` } as CSSProperties}
    >
      <span className="course-book__bookmark" aria-hidden="true" />
      <span className="course-book__edge" aria-hidden="true" />
      <span className="course-book__code">{code}</span>
      <strong className="course-book__title">{title}</strong>
      <span className="course-book__progress">
        <span />
      </span>
      <span className="course-book__percent">{hasProgress ? `${pct}%` : "—"}</span>
    </Link>
  );
}

export function WoodenShelf({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("wooden-shelf", className)}>
      <div className="wooden-shelf__interior">{children}</div>
      <div className="wooden-shelf__lip" aria-hidden="true" />
    </div>
  );
}

export function PaperPanel({
  children,
  className,
  pinned = false,
  folded = false,
}: {
  children: ReactNode;
  className?: string;
  pinned?: boolean;
  folded?: boolean;
}) {
  return (
    <section className={cn("paper-panel", pinned && "paper-panel--pinned", folded && "paper-panel--folded", className)}>
      {pinned && <span className="paper-pin" aria-hidden="true" />}
      {children}
    </section>
  );
}

export function FolderCard({
  title,
  count,
  tone = "ochre",
  active = false,
}: {
  title: string;
  count: number;
  tone?: "ochre" | "green" | "rust" | "umber" | "cream";
  active?: boolean;
}) {
  return (
    <button type="button" className={cn("folder-card", `folder-card--${tone}`, active && "is-active")}>
      <span className="folder-card__tab" aria-hidden="true" />
      <span className="folder-card__title">{title}</span>
      <strong>{count}</strong>
      <span className="folder-card__meta">files</span>
    </button>
  );
}

export function RoomHeading({ eyebrow, title, subtitle, actions }: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="room-heading">
      <div>
        {eyebrow && <p className="room-eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {subtitle && <p className="room-heading__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="room-heading__actions">{actions}</div>}
    </header>
  );
}

export function BrassButton({ children, className, onClick, type = "button" }: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return <button type={type} className={cn("brass-button", className)} onClick={onClick}>{children}</button>;
}

export function PaperButton({ children, className, onClick }: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return <button type="button" className={cn("paper-button", className)} onClick={onClick}>{children}</button>;
}

export function EmptyInk({ children }: { children: ReactNode }) {
  return <div className="empty-ink">{children}</div>;
}
