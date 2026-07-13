import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Lang } from "./i18n";
import { dicts } from "./i18n";

type Theme = "dark" | "light";

interface AppState {
  lang: Lang;
  setLang: (l: Lang) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  t: (typeof dicts)["ru"];
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("ru");
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    try {
      const l = localStorage.getItem("lamdan.lang") as Lang | null;
      const th = localStorage.getItem("lamdan.theme") as Theme | null;
      if (l === "ru" || l === "en") setLang(l);
      if (th === "dark" || th === "light") setTheme(th);
    } catch {
      // Local preferences are optional.
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("dir", "ltr");
    root.setAttribute("lang", lang);
    try {
      localStorage.setItem("lamdan.lang", lang);
    } catch {
      // Local preferences are optional.
    }
  }, [lang]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("light", theme === "light");
    root.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem("lamdan.theme", theme);
    } catch {
      // Local preferences are optional.
    }
  }, [theme]);

  const value = useMemo<AppState>(
    () => ({ lang, setLang, theme, setTheme, t: dicts[lang] }),
    [lang, theme],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside AppProvider");
  return v;
}
