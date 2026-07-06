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
    <div className="flex items-center gap-2">
      <div className="relative h-8 w-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
        <span className="text-primary font-bold text-sm">L</span>
      </div>
      <div className="flex flex-col leading-none">
        <span className="font-bold text-sm tracking-tight">Lamdan</span>
        <span className="text-[10px] text-muted-foreground">Study workspace</span>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { lang, setLang, theme, setTheme, t } = useApp();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  const items = [
    { to: "/app/dashboard", label: t.dashboard, icon: LayoutDashboard },
    { to: "/app/program", label: t.program, icon: GraduationCap },
    { to: "/app/courses", label: t.courses, icon: BookOpen },
    { to: "/app/notes", label: t.notes, icon: FileText },
    { to: "/app/flashcards", label: t.flashcards, icon: Layers },
    { to: "/app/quizzes", label: t.quizzes, icon: HelpCircle },
    { to: "/app/assignments", label: t.assignments, icon: ClipboardList },
    { to: "/app/progress", label: t.progress, icon: BarChart3 },
    { to: "/app/data", label: t.data, icon: Database },
    { to: "/app/settings", label: t.settings, icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background flex w-full">
      <aside className="hidden lg:flex flex-col w-60 shrink-0 h-screen sticky top-0 bg-sidebar border-e border-sidebar-border">
        <div className="p-4 border-b border-sidebar-border">
          <LogoMark />
        </div>
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {items.map((it) => {
            const active = pathname === it.to || pathname.startsWith(it.to + "/");
            const Icon = it.icon;
            return (
              <Link
                key={it.to}
                to={it.to as never}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{it.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 h-14 bg-background/80 backdrop-blur-xl border-b border-border flex items-center gap-2 px-3 lg:px-6">
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
            <nav className="space-y-0.5">
              {items.map((it) => {
                const Icon = it.icon;
                const active = pathname === it.to || pathname.startsWith(it.to + "/");
                return (
                  <Link
                    key={it.to}
                    to={it.to as never}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {it.label}
                  </Link>
                );
              })}
            </nav>
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
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
