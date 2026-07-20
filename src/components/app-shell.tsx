import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home,
  BookOpen,
  FolderOpen,
  FileText,
  Layers3,
  CircleHelp,
  FileInput,
  Database,
  Search,
  Menu,
  X,
  Languages,
  ChevronRight,
  Leaf,
  Settings,
  Mic2,
  GraduationCap,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import "@/content-workspace.css";
import "@/ux-foundation.css";
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

type NavItem = {
  to: string;
  labelKey: LabelKey;
  icon: typeof Home;
};

const overviewNav: ReadonlyArray<NavItem> = [
  { to: "/app/dashboard", labelKey: "dashboard", icon: Home },
];

const libraryNav: ReadonlyArray<NavItem> = [
  { to: "/app/courses", labelKey: "courses", icon: BookOpen },
  { to: "/app/materials", labelKey: "materials", icon: FolderOpen },
  { to: "/app/lecture-media", labelKey: "lecture", icon: Mic2 },
  { to: "/app/notes", labelKey: "notes", icon: FileText },
  { to: "/app/flashcards", labelKey: "flashcards", icon: Layers3 },
  { to: "/app/quizzes", labelKey: "quizzes", icon: CircleHelp },
];

const focusNav: ReadonlyArray<NavItem> = [
  { to: "/app/exam-engine", labelKey: "exam", icon: GraduationCap },
];

const utilityNav: ReadonlyArray<NavItem> = [
  { to: "/app/import-syllabus", labelKey: "importSyllabus", icon: FileInput },
  { to: "/app/search", labelKey: "searchNav", icon: Search },
  { to: "/app/data", labelKey: "data", icon: Database },
  { to: "/app/settings", labelKey: "settings", icon: Settings },
];

function Brand() {
  const { lang } = useApp();
  return (
    <Link
      to="/app/dashboard"
      className="content-brand"
      aria-label={lang === "ru" ? "Главная Lamdan" : "Lamdan home"}
    >
      <span className="content-brand__mark" aria-hidden="true">
        <Leaf size={17} />
      </span>
      <span className="content-brand__copy">
        <strong>Lamdan</strong>
        <small>{lang === "ru" ? "система учебного контента" : "study content system"}</small>
      </span>
    </Link>
  );
}

function NavGroup({
  label,
  items,
  pathname,
  compact,
  onNavigate,
}: {
  label: string;
  items: ReadonlyArray<NavItem>;
  pathname: string;
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const { t } = useApp();
  return (
    <div className="content-nav-group">
      <div className="content-nav__label">{label}</div>
      <nav className="content-nav" aria-label={label}>
        {items.map((item) => {
          const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
          const Icon = item.icon;
          const itemLabel = t[item.labelKey];
          return (
            <Link
              key={item.to}
              to={item.to as never}
              onClick={onNavigate}
              className={cn("content-nav__item", active && "is-active")}
              title={compact ? itemLabel : undefined}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={17} strokeWidth={1.7} />
              <span>{itemLabel}</span>
              <ChevronRight className="content-nav__arrow" size={13} />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function SidebarContent({
  pathname,
  compact = false,
  showCompactToggle = false,
  onToggleCompact,
  onNavigate,
}: {
  pathname: string;
  compact?: boolean;
  showCompactToggle?: boolean;
  onToggleCompact?: () => void;
  onNavigate?: () => void;
}) {
  const { lang, setLang } = useApp();
  const workspaceLabel = lang === "ru" ? "Рабочий стол" : "Desk";
  const libraryLabel = lang === "ru" ? "Библиотека" : "Library";
  const focusLabel = lang === "ru" ? "Подготовка" : "Focus";
  const systemLabel = lang === "ru" ? "Система" : "System";

  return (
    <>
      <div className="content-sidebar__brand-row">
        <Brand />
        {showCompactToggle && (
          <button
            type="button"
            className="content-sidebar__collapse"
            onClick={onToggleCompact}
            aria-label={
              compact
                ? lang === "ru"
                  ? "Развернуть боковую панель"
                  : "Expand sidebar"
                : lang === "ru"
                  ? "Свернуть боковую панель"
                  : "Collapse sidebar"
            }
            title={
              compact
                ? lang === "ru"
                  ? "Развернуть"
                  : "Expand"
                : lang === "ru"
                  ? "Свернуть"
                  : "Collapse"
            }
          >
            {compact ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        )}
      </div>

      <Link
        to="/app/dashboard"
        onClick={onNavigate}
        className="content-sidebar__primary-action"
        title={compact ? (lang === "ru" ? "Добавить материалы" : "Add materials") : undefined}
      >
        <Plus size={17} />
        <span>{lang === "ru" ? "Добавить материалы" : "Add materials"}</span>
      </Link>

      <div className="content-sidebar__navigation">
        <NavGroup
          label={workspaceLabel}
          items={overviewNav}
          pathname={pathname}
          compact={compact}
          onNavigate={onNavigate}
        />
        <NavGroup
          label={libraryLabel}
          items={libraryNav}
          pathname={pathname}
          compact={compact}
          onNavigate={onNavigate}
        />
        <NavGroup
          label={focusLabel}
          items={focusNav}
          pathname={pathname}
          compact={compact}
          onNavigate={onNavigate}
        />
        <NavGroup
          label={systemLabel}
          items={utilityNav}
          pathname={pathname}
          compact={compact}
          onNavigate={onNavigate}
        />
      </div>

      <div className="content-sidebar__footer">
        <Select value={lang} onValueChange={(value) => setLang(value as Lang)}>
          <SelectTrigger
            className="content-language"
            aria-label={lang === "ru" ? "Язык" : "Language"}
            title={compact ? (lang === "ru" ? "Язык интерфейса" : "Interface language") : undefined}
          >
            <Languages size={14} />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ru">RU</SelectItem>
            <SelectItem value="en">EN</SelectItem>
          </SelectContent>
        </Select>
        <div className="content-sidebar__note">
          {lang === "ru"
            ? "Курсы, материалы, лекции, конспекты, карточки, тесты и экзамены — без лишнего трекинга."
            : "Courses, materials, lectures, notes, flashcards, quizzes and exams — without tracking noise."}
        </div>
      </div>
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { lang } = useApp();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCompact, setSidebarCompact] = useState(false);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileDrawerRef = useRef<HTMLElement>(null);
  const mobileCloseButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setSidebarCompact(localStorage.getItem("lamdan.sidebar.compact") === "true");
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    const drawer = mobileDrawerRef.current;
    const focusableSelector =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusInitialControl = window.requestAnimationFrame(() => {
      mobileCloseButtonRef.current?.focus();
    });
    const handleDrawerKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileOpen(false);
        return;
      }
      if (event.key !== "Tab" || !drawer) return;
      const focusable = Array.from(drawer.querySelectorAll<HTMLElement>(focusableSelector)).filter(
        (element) =>
          !element.hasAttribute("hidden") && element.getAttribute("aria-hidden") !== "true",
      );
      if (focusable.length === 0) {
        event.preventDefault();
        drawer.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleDrawerKeyDown);
    return () => {
      window.cancelAnimationFrame(focusInitialControl);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleDrawerKeyDown);
      mobileMenuButtonRef.current?.focus();
    };
  }, [mobileOpen]);

  const toggleSidebar = () => {
    setSidebarCompact((current) => {
      const next = !current;
      localStorage.setItem("lamdan.sidebar.compact", String(next));
      return next;
    });
  };

  return (
    <div className={cn("content-app", sidebarCompact && "content-app--compact")}>
      <a className="content-skip-link" href="#lamdan-main-content">
        {lang === "ru" ? "Перейти к содержанию" : "Skip to content"}
      </a>

      <aside
        className="content-sidebar"
        aria-label={lang === "ru" ? "Навигация Lamdan" : "Lamdan navigation"}
      >
        <SidebarContent
          pathname={pathname}
          compact={sidebarCompact}
          showCompactToggle
          onToggleCompact={toggleSidebar}
        />
      </aside>

      <div className="content-main">
        <header className="content-mobile-header">
          <button
            ref={mobileMenuButtonRef}
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label={lang === "ru" ? "Открыть навигацию" : "Open navigation"}
            aria-expanded={mobileOpen}
            aria-controls="lamdan-mobile-navigation"
          >
            <Menu size={21} />
          </button>
          <Brand />
          <span aria-hidden="true" />
        </header>
        <main id="lamdan-main-content" className="content-main__content" tabIndex={-1}>
          {children}
        </main>
      </div>

      {mobileOpen && (
        <div className="content-mobile-drawer-layer">
          <button
            className="content-mobile-drawer-layer__veil"
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label={lang === "ru" ? "Закрыть навигацию" : "Close navigation"}
          />
          <aside
            ref={mobileDrawerRef}
            id="lamdan-mobile-navigation"
            className="content-mobile-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lamdan-mobile-navigation-title"
            tabIndex={-1}
          >
            <div className="content-mobile-drawer__header">
              <span id="lamdan-mobile-navigation-title">
                {lang === "ru" ? "Навигация" : "Navigation"}
              </span>
              <button
                ref={mobileCloseButtonRef}
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label={lang === "ru" ? "Закрыть меню" : "Close menu"}
              >
                <X size={20} />
              </button>
            </div>
            <SidebarContent pathname={pathname} onNavigate={() => setMobileOpen(false)} />
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
    <header className="content-page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="content-page-header__actions">{actions}</div>}
    </header>
  );
}
