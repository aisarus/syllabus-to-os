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
} from "lucide-react";
import { useState, type ReactNode } from "react";
import "@/content-workspace.css";
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

const coreNav: ReadonlyArray<NavItem> = [
  { to: "/app/dashboard", labelKey: "dashboard", icon: Home },
  { to: "/app/courses", labelKey: "courses", icon: BookOpen },
  { to: "/app/materials", labelKey: "materials", icon: FolderOpen },
  { to: "/app/notes", labelKey: "notes", icon: FileText },
  { to: "/app/flashcards", labelKey: "flashcards", icon: Layers3 },
  { to: "/app/quizzes", labelKey: "quizzes", icon: CircleHelp },
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
      <span>
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
  onNavigate,
}: {
  label: string;
  items: ReadonlyArray<NavItem>;
  pathname: string;
  onNavigate?: () => void;
}) {
  const { t } = useApp();
  return (
    <div>
      <div className="content-nav__label">{label}</div>
      <nav className="content-nav" aria-label={label}>
        {items.map((item) => {
          const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to as never}
              onClick={onNavigate}
              className={cn("content-nav__item", active && "is-active")}
            >
              <Icon size={16} strokeWidth={1.7} />
              <span>{t[item.labelKey]}</span>
              <ChevronRight className="content-nav__arrow" size={13} />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function SidebarContent({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const { lang, setLang } = useApp();
  return (
    <>
      <Brand />
      <NavGroup
        label={lang === "ru" ? "Рабочее пространство" : "Workspace"}
        items={coreNav}
        pathname={pathname}
        onNavigate={onNavigate}
      />
      <NavGroup
        label={lang === "ru" ? "Система" : "System"}
        items={utilityNav}
        pathname={pathname}
        onNavigate={onNavigate}
      />
      <div className="content-sidebar__footer">
        <Select value={lang} onValueChange={(value) => setLang(value as Lang)}>
          <SelectTrigger
            className="content-language"
            aria-label={lang === "ru" ? "Язык" : "Language"}
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
            ? "Курсы, материалы, конспекты, карточки и тесты — без лишнего трекинга."
            : "Courses, materials, notes, flashcards and quizzes — without tracking noise."}
        </div>
      </div>
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { lang } = useApp();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="content-app">
      <aside className="content-sidebar" aria-label={lang === "ru" ? "Навигация Lamdan" : "Lamdan navigation"}>
        <SidebarContent pathname={pathname} />
      </aside>

      <div className="content-main">
        <header className="content-mobile-header">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label={lang === "ru" ? "Открыть навигацию" : "Open navigation"}
          >
            <Menu size={21} />
          </button>
          <Brand />
          <span aria-hidden="true" />
        </header>
        <main className="content-main__content">{children}</main>
      </div>

      {mobileOpen && (
        <div className="content-mobile-drawer-layer">
          <button
            className="content-mobile-drawer-layer__veil"
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label={lang === "ru" ? "Закрыть навигацию" : "Close navigation"}
          />
          <aside className="content-mobile-drawer">
            <div className="content-mobile-drawer__header">
              <span />
              <button
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
