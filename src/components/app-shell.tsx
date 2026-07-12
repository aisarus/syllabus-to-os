import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  GraduationCap,
  BookOpen,
  FileText,
  Layers,
  HelpCircle,
  ClipboardList,
  BarChart3,
  Settings,
  Database,
  Sun,
  Moon,
  Menu,
  X,
  Languages,
  FolderOpen,
  CalendarDays,
  Target,
  Presentation,
  FileInput,
  Search,
  Feather,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useApp } from "@/lib/app-context";
import type { Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function LogoMark() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative h-9 w-9 rounded-md flex items-center justify-center bg-gradient-to-br from-[oklch(0.78_0.14_82)] to-[oklch(0.55_0.10_60)] shadow-[inset_0_1px_0_oklch(1_0_0/0.3),0_2px_6px_-2px_oklch(0_0_0/0.5)]">
        <Feather className="h-4 w-4 text-[oklch(0.20_0.02_90)]" strokeWidth={2.5} />
      </div>
      <div className="flex flex-col leading-none">
        <span className="font-display font-semibold text-[15px] tracking-tight text-sidebar-foreground">Lamdan</span>
        <span className="text-[10px] uppercase tracking-[0.15em] text-sidebar-foreground/50">study room</span>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { lang, setLang, theme, setTheme, t } = useApp();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  const groupLabels = lang === "ru"
    ? { home: "Главная", library: "Библиотека", study: "Учёба", planning: "Планирование", system: "Система" }
    : { home: "Home", library: "Library", study: "Study", planning: "Planning", system: "System" };

  const groups = [
    {
      label: groupLabels.home,
      items: [
        { to: "/app/dashboard", label: t.dashboard, icon: LayoutDashboard },
        { to: "/app/search", label: t.searchNav, icon: Search },
      ],
    },
    {
      label: groupLabels.library,
      items: [
        { to: "/app/program", label: t.program, icon: GraduationCap },
        { to: "/app/courses", label: t.courses, icon: BookOpen },
        { to: "/app/materials", label: t.materials, icon: FolderOpen },
        { to: "/app/import-syllabus", label: t.importSyllabus, icon: FileInput },
      ],
    },
    {
      label: groupLabels.study,
      items: [
        { to: "/app/notes", label: t.notes, icon: FileText },
        { to: "/app/flashcards", label: t.flashcards, icon: Layers },
        { to: "/app/quizzes", label: t.quizzes, icon: HelpCircle },
        { to: "/app/assignments", label: t.assignments, icon: ClipboardList },
        { to: "/app/presentations", label: t.presentations, icon: Presentation },
      ],
    },
    {
      label: groupLabels.planning,
      items: [
        { to: "/app/calendar", label: t.calendar, icon: CalendarDays },
        { to: "/app/study-plan", label: t.studyPlan, icon: Target },
        { to: "/app/progress", label: t.progress, icon: BarChart3 },
      ],
    },
    {
      label: groupLabels.system,
      items: [
        { to: "/app/data", label: t.data, icon: Database },
        { to: "/app/settings", label: t.settings, icon: Settings },
      ],
    },
  ];

  const renderNavLink = (
    it: { to: string; label: string; icon: React.ComponentType<{ className?: string }> },
    onClick?: () => void,
  ) => {
    const active = pathname === it.to || pathname.startsWith(it.to + "/");
    const Icon = it.icon;
    return (
      <Link
        key={it.to}
        to={it.to as never}
        onClick={onClick}
        className={cn(
          "group relative flex items-center gap-3 rounded-md px-3 py-2 text-[13px] transition-colors",
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_2px_0_0_var(--brass)]"
            : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
        )}
      >
        <Icon className={cn("h-4 w-4 shrink-0", active ? "text-brass" : "opacity-80")} />
        <span className="truncate">{it.label}</span>
      </Link>
    );
  };

  return (
    <div className="min-h-screen library-bg flex w-full">
      <aside className="hidden lg:flex flex-col w-64 shrink-0 h-screen sticky top-0 bg-sidebar border-e border-sidebar-border">
        <div className="p-4 border-b border-sidebar-border">
          <LogoMark />
        </div>
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          {groups.map((g) => (
            <div key={g.label}>
              <div className="px-3 pb-1.5 text-[10px] font-medium uppercase tracking-[0.15em] text-sidebar-foreground/40">
                {g.label}
              </div>
              <div className="space-y-0.5">{g.items.map((it) => renderNavLink(it))}</div>
            </div>
          ))}
        </nav>
        <div className="p-4 border-t border-sidebar-border">
          <p className="font-display italic text-[13px] leading-snug text-sidebar-foreground/70">
            &ldquo;Everything you need is already on the shelf.&rdquo;
          </p>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 h-14 bg-background/70 backdrop-blur-xl border-b border-border flex items-center gap-2 px-3 lg:px-6">
          <button
            className="lg:hidden p-2 rounded-md hover:bg-accent"
            onClick={() => setMobileOpen(true)}
            aria-label="Menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="lg:hidden">
            <LogoMark />
          </div>
          <div className="flex-1" />
          <Select value={lang} onValueChange={(v) => setLang(v as Lang)}>
            <SelectTrigger className="h-9 w-[90px] bg-surface border-border text-xs">
              <Languages className="h-3.5 w-3.5 me-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ru">RU</SelectItem>
              <SelectItem value="en">EN</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </header>

        <main className="flex-1 min-w-0 p-4 lg:p-8">{children}</main>
      </div>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="absolute top-0 bottom-0 start-0 w-72 bg-sidebar border-e border-sidebar-border p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <LogoMark />
              <button onClick={() => setMobileOpen(false)} className="p-1 rounded hover:bg-accent">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              {groups.map((g) => (
                <div key={g.label}>
                  <div className="px-3 pb-1.5 text-[10px] font-medium uppercase tracking-[0.15em] text-sidebar-foreground/40">
                    {g.label}
                  </div>
                  <div className="space-y-0.5">
                    {g.items.map((it) => renderNavLink(it, () => setMobileOpen(false)))}
                  </div>
                </div>
              ))}
            </div>
          </div>
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
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-8 pb-4 border-b border-border/50">
      <div>
        <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
