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
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import "@/immersive-dashboard-fixed.css";
import { useApp } from "@/lib/app-context";
import type { Dict, Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type LabelKey = keyof Dict;

const IMMERSIVE_CANVAS_WIDTH = 1536;
const IMMERSIVE_CANVAS_HEIGHT = 1024;
const IMMERSIVE_DESKTOP_BREAKPOINT = 900;

function useImmersiveDashboardScale(enabled: boolean) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!enabled) {
      setScale(1);
      return;
    }

    const updateScale = () => {
      if (window.innerWidth < IMMERSIVE_DESKTOP_BREAKPOINT) {
        setScale(1);
        return;
      }

      const nextScale = Math.min(
        window.innerWidth / IMMERSIVE_CANVAS_WIDTH,
        window.innerHeight / IMMERSIVE_CANVAS_HEIGHT,
        1.05,
      );
      setScale(Math.max(0.5, nextScale));
    };

    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [enabled]);

  return scale;
}

const primaryNav: ReadonlyArray<{ to: string; labelKey: LabelKey; icon: typeof Home }> = [
  { to: "/app/dashboard", labelKey: "dashboard", icon: Home },
  { to: "/app/courses", labelKey: "courses", icon: BookOpen },
  { to: "/app/materials", labelKey: "materials", icon: FolderOpen },
  { to: "/app/notes", labelKey: "notes", icon: FileText },
  { to: "/app/flashcards", labelKey: "flashcards", icon: Layers3 },
  { to: "/app/quizzes", labelKey: "quizzes", icon: CircleHelp },
  { to: "/app/assignments", labelKey: "assignments", icon: ClipboardCheck },
  { to: "/app/calendar", labelKey: "calendar", icon: CalendarDays },
  { to: "/app/study-plan", labelKey: "studyPlan", icon: MapPinned },
  { to: "/app/progress", labelKey: "progress", icon: TrendingUp },
  { to: "/app/study-session", labelKey: "studySession", icon: TimerReset },
  { to: "/app/settings", labelKey: "settings", icon: Settings },
];

const utilityNav: ReadonlyArray<{ to: string; labelKey: LabelKey; icon: typeof Home }> = [
  { to: "/app/search", labelKey: "searchNav", icon: Search },
  { to: "/app/import-syllabus", labelKey: "importSyllabus", icon: FileInput },
  { to: "/app/presentations", labelKey: "presentations", icon: Presentation },
  { to: "/app/data", labelKey: "data", icon: Database },
];

function BrandPlaque() {
  const { lang } = useApp();
  return (
    <Link
      to="/app/dashboard"
      className="brand-plaque"
      aria-label={lang === "ru" ? "Главная Lamdan" : "Lamdan home"}
    >
      <span className="brand-plaque__seal">
        <Leaf size={15} />
      </span>
      <span>
        <strong>Lamdan</strong>
        <small>{lang === "ru" ? "учебная комната" : "study room"}</small>
      </span>
    </Link>
  );
}

function NavList({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const { t, lang } = useApp();
  return (
    <>
      <nav
        className="cabinet-nav"
        aria-label={lang === "ru" ? "Основная навигация" : "Main navigation"}
      >
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
              <span className="cabinet-nav__icon">
                <Icon size={15} strokeWidth={1.7} />
              </span>
              <span>{t[item.labelKey]}</span>
              <ChevronRight className="cabinet-nav__arrow" size={13} />
            </Link>
          );
        })}
      </nav>

      <details className="utility-drawer" open>
        <summary>{lang === "ru" ? "Другие инструменты" : "More tools"}</summary>
        <div>
          {utilityNav.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to as never} onClick={onNavigate}>
                <Icon size={14} />
                {t[item.labelKey]}
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
  const immersiveDashboard = pathname === "/app/dashboard";
  const immersiveScale = useImmersiveDashboardScale(immersiveDashboard);
  const viewportStyle = immersiveDashboard
    ? ({ "--immersive-scale": immersiveScale } as CSSProperties)
    : undefined;
  const liveLayerStyle = immersiveDashboard ? ({ opacity: 0 } as CSSProperties) : undefined;

  return (
    <div
      className={cn(
        "study-app-viewport",
        immersiveDashboard && "study-app-viewport--immersive",
      )}
      style={viewportStyle}
    >
      <div
        className={cn(
          "study-app-shell",
          immersiveDashboard && "study-app-shell--reference-canvas",
        )}
      >
        <div className="study-app-shell__top-trim" aria-hidden="true" style={liveLayerStyle} />
        <div className="study-app-shell__bottom-plinth" aria-hidden="true" style={liveLayerStyle} />

        <aside
          className="study-cabinet"
          aria-label="Lamdan navigation cabinet"
          style={liveLayerStyle}
        >
          <span className="study-cabinet__sconce" aria-hidden="true" />
          <div className="study-cabinet__top">
            <BrandPlaque />
          </div>
          <div className="study-cabinet__vine study-cabinet__vine--left" aria-hidden="true" />
          <div className="study-cabinet__vine study-cabinet__vine--right" aria-hidden="true" />
          <NavList pathname={pathname} />
          <blockquote>
            {lang === "ru"
              ? "«Всё, что тебе нужно, уже стоит у тебя на полке.»"
              : "“Everything you need is already on the shelf.”"}
          </blockquote>
          <div className="study-cabinet__footer">
            <Select value={lang} onValueChange={(v) => setLang(v as Lang)}>
              <SelectTrigger
                className="cabinet-language"
                aria-label={lang === "ru" ? "Язык" : "Language"}
              >
                <Languages size={13} />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ru">RU</SelectItem>
                <SelectItem value="en">EN</SelectItem>
              </SelectContent>
            </Select>
            <span>{lang === "ru" ? "локальное пространство" : "local workspace"}</span>
          </div>
        </aside>

        <div className="study-stage" style={liveLayerStyle}>
          <div className="study-stage__side-shadow" aria-hidden="true" />
          <header className="mobile-study-header">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label={lang === "ru" ? "Открыть навигацию" : "Open navigation"}
            >
              <Menu size={21} />
            </button>
            <BrandPlaque />
            <span />
          </header>
          <main className="study-stage__content">{children}</main>
        </div>

        {mobileOpen && (
          <div className="mobile-cabinet-layer" style={liveLayerStyle}>
            <button
              className="mobile-cabinet-layer__veil"
              onClick={() => setMobileOpen(false)}
              aria-label={lang === "ru" ? "Закрыть навигацию" : "Close navigation"}
            />
            <aside className="mobile-cabinet">
              <div className="mobile-cabinet__header">
                <BrandPlaque />
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label={lang === "ru" ? "Закрыть меню" : "Close menu"}
                >
                  <X size={20} />
                </button>
              </div>
              <NavList pathname={pathname} onNavigate={() => setMobileOpen(false)} />
            </aside>
          </div>
        )}
      </div>
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
