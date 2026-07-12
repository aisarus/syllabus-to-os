import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home,
  BookOpen,
  FolderOpen,
  FileText,
  Layers3,
  CircleHelp,
  ClipboardCheck,
  CalendarDays,
  MapPinned,
  TrendingUp,
  TimerReset,
  Settings,
  Presentation,
  FileInput,
  Database,
  Search,
  Menu,
  X,
  Languages,
  ChevronRight,
  Leaf,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useApp } from "@/lib/app-context";
import type { Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const primaryNav = [
  { to: "/app/dashboard", label: "Home", icon: Home },
  { to: "/app/courses", label: "Courses", icon: BookOpen },
  { to: "/app/materials", label: "Materials", icon: FolderOpen },
  { to: "/app/notes", label: "Notes", icon: FileText },
  { to: "/app/flashcards", label: "Flashcards", icon: Layers3 },
  { to: "/app/quizzes", label: "Quizzes", icon: CircleHelp },
  { to: "/app/assignments", label: "Assignments", icon: ClipboardCheck },
  { to: "/app/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/app/study-plan", label: "Study Plan", icon: MapPinned },
  { to: "/app/progress", label: "Progress", icon: TrendingUp },
  { to: "/app/study-session", label: "Study Session", icon: TimerReset },
  { to: "/app/settings", label: "Settings", icon: Settings },
] as const;

const utilityNav = [
  { to: "/app/search", label: "Search", icon: Search },
  { to: "/app/import-syllabus", label: "Import syllabus", icon: FileInput },
  { to: "/app/presentations", label: "Presentations", icon: Presentation },
  { to: "/app/data", label: "Import / Export", icon: Database },
] as const;

function BrandPlaque() {
  return (
    <Link to="/app/dashboard" className="brand-plaque" aria-label="Lamdan home">
      <span className="brand-plaque__seal"><Leaf size={15} /></span>
      <span>
        <strong>Lamdan</strong>
        <small>study room</small>
      </span>
    </Link>
  );
}

function NavList({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <>
      <nav className="cabinet-nav" aria-label="Main navigation">
        {primaryNav.map((item) => {
          const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to as never}
              onClick={onNavigate}
              className={cn("cabinet-nav__item", active && "is-active")}
            >
              <span className="cabinet-nav__icon"><Icon size={15} strokeWidth={1.7} /></span>
              <span>{item.label}</span>
              <ChevronRight className="cabinet-nav__arrow" size={13} />
            </Link>
          );
        })}
      </nav>

      <details className="utility-drawer">
        <summary>More tools</summary>
        <div>
          {utilityNav.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to as never} onClick={onNavigate}>
                <Icon size={14} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </details>
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { lang, setLang } = useApp();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="study-app-shell">
      <aside className="study-cabinet" aria-label="Lamdan navigation cabinet">
        <div className="study-cabinet__top"><BrandPlaque /></div>
        <div className="study-cabinet__vine study-cabinet__vine--left" aria-hidden="true" />
        <div className="study-cabinet__vine study-cabinet__vine--right" aria-hidden="true" />
        <NavList pathname={pathname} />
        <blockquote>“Everything you need is already on the shelf.”</blockquote>
        <div className="study-cabinet__footer">
          <Select value={lang} onValueChange={(v) => setLang(v as Lang)}>
            <SelectTrigger className="cabinet-language" aria-label="Language">
              <Languages size={13} />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ru">RU</SelectItem>
              <SelectItem value="en">EN</SelectItem>
            </SelectContent>
          </Select>
          <span>local workspace</span>
        </div>
      </aside>

      <div className="study-stage">
        <header className="mobile-study-header">
          <button type="button" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <Menu size={21} />
          </button>
          <BrandPlaque />
          <span />
        </header>
        <main className="study-stage__content">{children}</main>
      </div>

      {mobileOpen && (
        <div className="mobile-cabinet-layer">
          <button className="mobile-cabinet-layer__veil" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />
          <aside className="mobile-cabinet">
            <div className="mobile-cabinet__header">
              <BrandPlaque />
              <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={20} /></button>
            </div>
            <NavList pathname={pathname} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="legacy-room-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="legacy-room-header__actions">{actions}</div>}
    </div>
  );
}
