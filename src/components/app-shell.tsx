import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, GraduationCap, Upload, Map, BookOpen, Network, FileText,
  Layers, HelpCircle, ClipboardList, Target, Rocket, Sparkles, BarChart3, Settings,
  Command, Search, Sun, Moon, Menu, X, Languages,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useApp } from "@/lib/app-context";
import { t as translations, isRTL, type Lang } from "@/lib/i18n";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Command as Cmdk, CommandDialog, CommandInput, CommandList, CommandItem, CommandGroup, CommandEmpty,
} from "@/components/ui/command";
import { demoProgram } from "@/lib/demo-data";

type Dict = Record<string, string>;

const navItems = (t: Dict) => [
  { to: "/app/dashboard", label: t.dashboard, icon: LayoutDashboard },
  { to: "/app/programs", label: t.programs, icon: GraduationCap },
  { to: "/upload", label: t.upload, icon: Upload },
  { to: "/app/course-map", label: t.courseMap, icon: Map },
  { to: "/app/courses", label: t.courses, icon: BookOpen },
  { to: "/app/graph", label: t.graph, icon: Network },
  { to: "/app/notes", label: t.notes, icon: FileText },
  { to: "/app/flashcards", label: t.flashcards, icon: Layers },
  { to: "/app/quizzes", label: t.quizzes, icon: HelpCircle },
  { to: "/app/assignments", label: t.assignments, icon: ClipboardList },
  { to: "/app/exam-prep", label: t.examPrep, icon: Target },
  { to: "/app/booster", label: t.booster, icon: Rocket },
  { to: "/app/tutor", label: t.tutor, icon: Sparkles },
  { to: "/app/analytics", label: t.analytics, icon: BarChart3 },
  { to: "/app/settings", label: t.settings, icon: Settings },
];

const mobileNav = (t: Dict) => [
  { to: "/app/dashboard", label: t.dashboard, icon: LayoutDashboard },
  { to: "/app/courses", label: t.courses, icon: BookOpen },
  { to: "/app/notes", label: t.notes, icon: FileText },
  { to: "/app/quizzes", label: t.quiz, icon: HelpCircle },
];

function LogoMark() {
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-8 w-8 rounded-lg gradient-primary shadow-glow flex items-center justify-center">
        <span className="text-primary-foreground font-bold text-sm">ל</span>
      </div>
      <div className="flex flex-col leading-none">
        <span className="font-bold text-sm tracking-tight text-gradient">Lamdan AI</span>
        <span className="text-[10px] text-muted-foreground">למדן • AI Study OS</span>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { lang, setLang, theme, setTheme, semester, setSemester } = useApp();
  const t = translations[lang];
  const rtl = isRTL(lang);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const items = navItems(t);
  const mItems = mobileNav(t);

  return (
    <div className="min-h-screen bg-background flex" dir={rtl ? "rtl" : "ltr"}>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col w-64 shrink-0 h-screen sticky top-0 bg-sidebar border-e border-sidebar-border",
        )}
      >
        <div className="p-4 border-b border-sidebar-border">
          <LogoMark />
        </div>
        <div className="p-3">
          <button
            onClick={() => setCmdOpen(true)}
            className="w-full flex items-center gap-2 rounded-md bg-sidebar-accent/60 hover:bg-sidebar-accent px-3 py-2 text-xs text-muted-foreground border border-sidebar-border transition"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="flex-1 text-start">{rtl ? "חיפוש / פקודות" : "Search / Command"}</span>
            <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-background/60 border border-sidebar-border">⌘K</kbd>
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
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
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{it.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <div className="glass-panel rounded-lg p-3">
            <div className="text-[11px] text-muted-foreground mb-1">{rtl ? "רצף למידה" : "Study streak"}</div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gradient">12</span>
              <span className="text-xs text-muted-foreground">{rtl ? "ימים" : "days"}</span>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-14 bg-background/70 backdrop-blur-xl border-b border-border flex items-center gap-2 px-3 lg:px-6">
          <button
            className="lg:hidden p-2 rounded-md hover:bg-accent"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="lg:hidden"><LogoMark /></div>
          <div className="hidden md:flex flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={rtl ? "חפש קורס, נושא, הערה..." : "Search courses, topics, notes..."}
                className="ps-9 bg-surface border-border h-9"
                onFocus={() => setCmdOpen(true)}
                readOnly
              />
            </div>
          </div>
          <div className="flex-1 md:hidden" />
          <Button variant="ghost" size="sm" className="hidden sm:flex gap-1.5" onClick={() => setCmdOpen(true)}>
            <Command className="h-3.5 w-3.5" /> <span className="text-xs">⌘K</span>
          </Button>
          <Select value={semester} onValueChange={setSemester}>
            <SelectTrigger className="hidden md:flex h-9 w-[190px] bg-surface border-border text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="סמסטר א' 2025/26">סמסטר א' 2025/26</SelectItem>
              <SelectItem value="סמסטר ב' 2025/26">סמסטר ב' 2025/26</SelectItem>
              <SelectItem value="סמסטר קיץ 2026">סמסטר קיץ 2026</SelectItem>
            </SelectContent>
          </Select>
          <Select value={lang} onValueChange={(v) => setLang(v as Lang)}>
            <SelectTrigger className="h-9 w-[80px] bg-surface border-border text-xs">
              <Languages className="h-3.5 w-3.5 me-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="he">עב</SelectItem>
              <SelectItem value="en">EN</SelectItem>
              <SelectItem value="ru">RU</SelectItem>
              <SelectItem value="ar">عر</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost" size="icon" className="h-9 w-9"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <div className="h-9 w-9 rounded-full gradient-primary flex items-center justify-center text-primary-foreground text-xs font-semibold">
            ד
          </div>
        </header>

        <main className="flex-1 min-w-0 pb-20 lg:pb-0">{children}</main>

        {/* Mobile bottom nav */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 h-16 bg-sidebar/95 backdrop-blur-xl border-t border-sidebar-border flex items-stretch">
          {mItems.map((it) => {
            const active = pathname === it.to;
            const Icon = it.icon;
            return (
              <Link
                key={it.to}
                to={it.to as never}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px]",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{it.label}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setMoreOpen(true)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] text-muted-foreground"
          >
            <Menu className="h-5 w-5" />
            <span>{t.more}</span>
          </button>
        </nav>
      </div>

      {/* Mobile drawer */}
      {(mobileOpen || moreOpen) && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => { setMobileOpen(false); setMoreOpen(false); }} />
          <div className={cn(
            "absolute top-0 bottom-0 w-72 bg-sidebar border-sidebar-border p-4 overflow-y-auto",
            rtl ? "end-0 border-s" : "start-0 border-e",
          )}>
            <div className="flex items-center justify-between mb-4">
              <LogoMark />
              <button onClick={() => { setMobileOpen(false); setMoreOpen(false); }} className="p-1 rounded hover:bg-accent">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="space-y-0.5">
              {items.map((it) => {
                const Icon = it.icon;
                const active = pathname === it.to;
                return (
                  <Link
                    key={it.to} to={it.to as never}
                    onClick={() => { setMobileOpen(false); setMoreOpen(false); }}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm",
                      active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60",
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

      {/* Command palette */}
      <CommandDialog open={cmdOpen} onOpenChange={setCmdOpen}>
        <CommandInput placeholder={rtl ? "חפש כל דבר..." : "Search anything..."} />
        <CommandList>
          <CommandEmpty>{rtl ? "אין תוצאות" : "No results"}</CommandEmpty>
          <CommandGroup heading={rtl ? "ניווט" : "Navigate"}>
            {items.slice(0, 8).map((it) => (
              <CommandItem key={it.to} onSelect={() => { setCmdOpen(false); window.location.href = it.to; }}>
                <it.icon className="me-2 h-4 w-4" /> {it.label}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading={rtl ? "קורסים" : "Courses"}>
            {demoProgram.courses.slice(0, 8).map((c) => (
              <CommandItem key={c.id} onSelect={() => { setCmdOpen(false); window.location.href = `/app/courses/${c.id}`; }}>
                <BookOpen className="me-2 h-4 w-4" />
                <span className="font-mono text-xs text-muted-foreground me-2">{c.number}</span>
                {c.titleHe}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}

export function PageHeader({
  title, subtitle, actions,
}: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
