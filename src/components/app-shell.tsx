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
import type { Dict, Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type NavKey = keyof Dict;

const primaryNav = [
  { to: "/app/dashboard", labelKey: "navHome", icon: Home },
  { to: "/app/courses", labelKey: "courses", icon: BookOpen },
  { to: "/app/materials", labelKey: "materials", icon: FolderOpen },
  { to: "/app/notes", labelKey: "notes", icon: FileText },
  { to: "/app/flashcards", labelKey: "flashcards", icon: Layers3 },
  { to: "/app/quizzes", labelKey: "quizzes", icon: CircleHelp },
  { to: "/app/assignments", labelKey: "assignments", icon: ClipboardCheck },
  { to: "/app/calendar", labelKey: "calendar", icon: CalendarDays },
  { to: "/app/study-plan", labelKey: "studyPlan", icon: MapPinned },
  { to: "/app/progress", labelKey: "progress", icon: TrendingUp },
  { to: "/app/study-session", labelKey: "navStudySession", icon: TimerReset },
  { to: "/app/settings", labelKey: "settings", icon: Settings },
] as const satisfies ReadonlyArray<{ to: string; labelKey: NavKey; icon: typeof Home }>;

const utilityNav = [
  { to: "/app/search", labelKey: "search", icon: Search },
  { to: "/app/import-syllabus", labelKey: "navImportSyllabus", icon: FileInput },
  { to: "/app/presentations", labelKey: "presentations", icon: Presentation },
  { to: "/app/data", labelKey: "data", icon: Database },
] as const satisfies ReadonlyArray<{ to: string; labelKey: NavKey; icon: typeof Home }>;

function BrandPlaque() {
  const { t } = useApp();
  return (
    <Link to="/app/dashboard" className="brand-plaque" aria-label={t.lamdanHomeAria}>
      <span className="brand-plaque__seal">
        <Leaf size={15} />
      </span>
      <span>
        <strong>{t.appName}</strong>
        <small>{t.studyRoomSubtitle}</small>
      </span>
    </Link>
  );
}

function NavList({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const { t } = useApp();
  return (
    <>
      <nav className="cabinet-nav" aria-label={t.mainNavigationAria}>
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
              <span>{t[item.labelKey] as string}</span>
              <ChevronRight className="cabinet-nav__arrow" size={13} />
            </Link>
          );
        })}
      </nav>

      <details className="utility-drawer">
        <summary>{t.navMoreTools}</summary>
        <div>
          {utilityNav.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to as never} onClick={onNavigate}>
                <Icon size={14} />
                {t[item.labelKey] as string}
              </Link>
            );
          })}
        </div>
      </details>
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { lang, setLang, t } = useApp();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="study-app-shell">
      <aside className="study-cabinet" aria-label={t.mainNavigationAria}>
        <div className="study-cabinet__top">
          <BrandPlaque />
        </div>
        <div className="study-cabinet__vine study-cabinet__vine--left" aria-hidden="true" />
        <div className="study-cabinet__vine study-cabinet__vine--right" aria-hidden="true" />
        <NavList pathname={pathname} />
        <blockquote>{`“${t.sidebarQuote}”`}</blockquote>
        <div className="study-cabinet__footer">
          <Select value={lang} onValueChange={(v) => setLang(v as Lang)}>
            <SelectTrigger className="cabinet-language" aria-label={t.language}>
              <Languages size={13} />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ru">RU</SelectItem>
              <SelectItem value="en">EN</SelectItem>
            </SelectContent>
          </Select>
          <span>{t.localWorkspace}</span>
        </div>
      </aside>

      <div className="study-stage">
        <header className="mobile-study-header">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label={t.openNavigationAria}
          >
            <Menu size={21} />
          </button>
          <BrandPlaque />
          <span />
        </header>
        <main className="study-stage__content">{children}</main>
      </div>

      {mobileOpen && (
        <div className="mobile-cabinet-layer">
          <button
            className="mobile-cabinet-layer__veil"
            onClick={() => setMobileOpen(false)}
            aria-label={t.closeNavigationAria}
          />
          <aside className="mobile-cabinet">
            <div className="mobile-cabinet__header">
              <BrandPlaque />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label={t.closeMenuAria}
              >
                <X size={20} />
              </button>
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
