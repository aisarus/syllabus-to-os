import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Lang } from "./i18n";
import { isRTL } from "./i18n";

type Theme = "dark" | "light";

interface AppState {
  lang: Lang;
  setLang: (l: Lang) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  semester: string;
  setSemester: (s: string) => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("he");
  const [theme, setTheme] = useState<Theme>("dark");
  const [semester, setSemester] = useState("סמסטר ב' 2025/26");

  useEffect(() => {
    try {
      const l = localStorage.getItem("lamdan.lang") as Lang | null;
      const t = localStorage.getItem("lamdan.theme") as Theme | null;
      if (l) setLang(l);
      if (t) setTheme(t);
    } catch {}
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("dir", isRTL(lang) ? "rtl" : "ltr");
    root.setAttribute("lang", lang);
    try { localStorage.setItem("lamdan.lang", lang); } catch {}
  }, [lang]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("light", theme === "light");
    root.classList.toggle("dark", theme === "dark");
    try { localStorage.setItem("lamdan.theme", theme); } catch {}
  }, [theme]);

  const value = useMemo(() => ({ lang, setLang, theme, setTheme, semester, setSemester }), [lang, theme, semester]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside AppProvider");
  return v;
}
