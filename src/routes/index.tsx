import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight, Upload as UploadIcon, Network, Layers, BookOpen, Target, Sparkles,
  Rocket, GraduationCap, FileText, BarChart3, CheckCircle2, Command,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lamdan AI · Turn any Israeli syllabus into a personal study OS" },
      { name: "description", content: "העלה סילבוס, ידיעון או קובץ קורס וקבל סביבת לימוד אישית בסגנון Obsidian – קורסים, הערות, כרטיסיות, בחנים והכנה למועד א׳/ב׳." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-40 bg-background/70 backdrop-blur-xl border-b border-border">
        <div className="mx-auto max-w-7xl px-4 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg gradient-primary shadow-glow flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">ל</span>
            </div>
            <span className="font-bold tracking-tight">Lamdan AI · <span className="text-muted-foreground font-medium">למדן</span></span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground">יכולות</a>
            <a href="#how" className="hover:text-foreground">איך זה עובד</a>
            <a href="#academia" className="hover:text-foreground">אקדמיה ישראלית</a>
            <a href="#pricing" className="hover:text-foreground">תמחור</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/app/dashboard"><Button variant="ghost" size="sm">כניסה</Button></Link>
            <Link to="/upload"><Button size="sm" className="gradient-primary shadow-glow">התחל בחינם</Button></Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden gradient-hero grid-bg">
        <div className="mx-auto max-w-7xl px-4 lg:px-8 pt-20 pb-28 md:pt-28 md:pb-36 relative">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs text-muted-foreground mb-6">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              נבנה במיוחד לאוניברסיטאות, מכללות ומכינות בישראל
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.1]">
              הפכו כל <span className="text-gradient">סילבוס</span> אוניברסיטאי<br />
              למערכת הפעלה ללימודים
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-2xl leading-relaxed">
              העלו סילבוס, ידיעון, PDF, DOCX או קובץ Excel של תכנית לימודים – ותקבלו קורסים, הערות, כרטיסיות, בחנים,
              מטלות, הכנה למועד א׳ ומועד ב׳ ומעקב התקדמות, בסביבה בסגנון Obsidian.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/upload">
                <Button size="lg" className="gradient-primary shadow-glow h-12 px-6 text-base">
                  <UploadIcon className="me-2 h-4 w-4" />
                  העלאת סילבוס
                  <ArrowRight className="ms-2 h-4 w-4 rtl:rotate-180" />
                </Button>
              </Link>
              <Link to="/app/dashboard">
                <Button size="lg" variant="outline" className="h-12 px-6 text-base border-border bg-surface/60">
                  צפייה בסביבת הדגמה
                </Button>
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-success" /> תמיכה בעברית RTL</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-success" /> נ״ז, מועד א׳/ב׳, סמסטרים</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-success" /> רב־לשוני: HE / EN / RU / AR</span>
            </div>
          </div>

          {/* Product preview card */}
          <div className="mt-16 relative">
            <div className="glass-panel rounded-2xl p-2 shadow-elegant">
              <div className="grid grid-cols-12 gap-2 rounded-xl bg-background/60 p-3 min-h-[340px]">
                <div className="col-span-3 rounded-lg bg-sidebar p-3 space-y-2 hidden md:block">
                  {["לוח בקרה", "התוכניות שלי", "מפת הקורסים", "קורסים", "גרף ידע", "הערות", "כרטיסיות", "בחנים", "מטלות", "הכנה למבחן", "מאיץ למידה", "מורה AI"].map((l, i) => (
                    <div key={l} className={`text-xs rounded px-2 py-1.5 ${i === 0 ? "bg-primary/20 text-primary" : "text-muted-foreground"}`}>{l}</div>
                  ))}
                </div>
                <div className="col-span-12 md:col-span-9 space-y-3">
                  <div className="rounded-lg bg-surface p-4 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg gradient-primary flex items-center justify-center text-primary-foreground text-xs font-bold">ל</div>
                    <div className="flex-1">
                      <div className="text-xs text-muted-foreground">סמסטר ב' 2025/26 · אוניברסיטת בר-אילן · לימודי מידע</div>
                      <div className="text-sm font-semibold">שלום דוד, יש לך 3 מטלות ו-2 מועדי א׳ השבוע</div>
                    </div>
                    <div className="hidden md:flex text-xs items-center gap-1 rounded border border-border px-2 py-1 text-muted-foreground"><Command className="h-3 w-3" /> K</div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { l: "קורסים פעילים", v: "9", i: BookOpen },
                      { l: "מטלות פתוחות", v: "5", i: FileText },
                      { l: "מועד א׳ קרובים", v: "3", i: Target },
                      { l: "רצף למידה", v: "12", i: Rocket },
                    ].map((s) => (
                      <div key={s.l} className="rounded-lg bg-surface p-3">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{s.l}</span><s.i className="h-3.5 w-3.5" />
                        </div>
                        <div className="mt-1 text-2xl font-bold text-gradient">{s.v}</div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      { n: "167", t: "מבוא לבינה מלאכותית", p: 62, s: "מועד א׳ בעוד 21 יום" },
                      { n: "162", t: "מבני נתונים", p: 48, s: "חלש: גרפים" },
                      { n: "166", t: "פיתוח Full Stack מתקדם", p: 35, s: "פרויקט – שלב 2" },
                    ].map((c) => (
                      <div key={c.n} className="rounded-lg bg-surface p-3">
                        <div className="text-[10px] font-mono text-muted-foreground">{c.n}</div>
                        <div className="text-sm font-semibold mt-0.5">{c.t}</div>
                        <div className="mt-2 h-1.5 bg-background rounded-full overflow-hidden">
                          <div className="h-full gradient-primary" style={{ width: `${c.p}%` }} />
                        </div>
                        <div className="mt-2 text-[11px] text-muted-foreground">{c.s}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section id="features" className="py-24">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <div className="max-w-2xl mb-14">
            <div className="text-xs uppercase tracking-widest text-primary mb-3">יכולות המוצר</div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">כל מה שצריך כדי לעבור, ואז להצטיין</h2>
            <p className="mt-3 text-muted-foreground">שילוב של Obsidian, Notion, Quizlet ו-Moodle – בעברית, מותאם לאקדמיה הישראלית.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { i: UploadIcon, t: "העלאת סילבוס חכמה", d: "PDF · DOCX · XLSX · CSV · TXT. חילוץ אוטומטי של קורסים, נ״ז, דרישות קדם, מועד א׳/ב׳." },
              { i: Network, t: "גרף ידע בסגנון Obsidian", d: "צפייה חזותית בקשרים בין קורסים, נושאים, בחנים ומטלות." },
              { i: BookOpen, t: "מפת קורסים לפי שנים וסמסטרים", d: "גורר וטופל: תואר ראשון, שני, מכינה, קורס בודד. מזהה קורסים מסוכנים." },
              { i: FileText, t: "הערות עם קישורים [[מושג]]", d: "Markdown, תגיות, backlinks, סיכום AI, תרגום ופישוט לעברית אקדמית." },
              { i: Layers, t: "כרטיסיות עם spaced repetition", d: "מצב טרמינולוגיה עברית-אנגלית-רוסית. יצירה אוטומטית מהערה, שיעור או טעויות." },
              { i: Target, t: "הכנה למועד א׳ ומועד ב׳", d: "תוכנית לימוד לפי ימים שנותרו, סימולציית מבחן, מצב 'המבחן מחר'." },
              { i: Rocket, t: "מאיץ למידה יומי", d: "מה ללמוד היום ב-15 / 30 / 60 דקות – לפי חולשות, דדליינים והתקדמות." },
              { i: Sparkles, t: "מורה AI מקובע לחומר שלך", d: "מסביר בעברית אקדמית, ברוסית או באנגלית. יוצר תרגילים ומפות מושגים." },
              { i: BarChart3, t: "אנליטיקה של למידה", d: "ציון בריאות ידע לכל קורס, סיכון כישלון, מוכנות למבחן, זמן למידה." },
            ].map((f) => (
              <div key={f.t} className="glass-panel rounded-xl p-5 hover:border-primary/40 transition-colors">
                <div className="h-9 w-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center mb-4">
                  <f.i className="h-4.5 w-4.5" />
                </div>
                <div className="font-semibold">{f.t}</div>
                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-24 bg-surface/40 border-y border-border">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <div className="max-w-2xl mb-14">
            <div className="text-xs uppercase tracking-widest text-primary mb-3">איך זה עובד</div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">מסילבוס לסביבת לימוד – בפחות מדקה</h2>
          </div>
          <div className="grid md:grid-cols-4 gap-4">
            {[
              { n: 1, t: "העלאת קובץ", d: "סילבוס, ידיעון, PDF, DOCX, XLSX או תכנית לימודים מלאה." },
              { n: 2, t: "ניתוח AI", d: "זיהוי מוסד, פקולטה, שנים, סמסטרים, נ״ז, דרישות קדם ומבחנים." },
              { n: 3, t: "עריכת מבנה", d: "אתם בשליטה: עריכה של קורסים, סוגי קורס, ומועדי בחינה." },
              { n: 4, t: "יצירת סביבה", d: "לוח בקרה מלא: הערות, כרטיסיות, בחנים ומפת ידע." },
            ].map((s) => (
              <div key={s.n} className="glass-panel rounded-xl p-5">
                <div className="text-4xl font-bold text-gradient">0{s.n}</div>
                <div className="mt-2 font-semibold">{s.t}</div>
                <div className="text-sm text-muted-foreground mt-1">{s.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Academia */}
      <section id="academia" className="py-24">
        <div className="mx-auto max-w-7xl px-4 lg:px-8 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <div className="text-xs uppercase tracking-widest text-primary mb-3">בנוי לאקדמיה הישראלית</div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">מבין את השפה של הסטודנט הישראלי</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              נ״ז, סמסטר א׳/ב׳/קיץ, קורס חובה/בחירה/סמינריון, מועד א׳ ומועד ב׳, פרויקט גמר, ציון סופי, שעות קבלה, סגל הקורס –
              המערכת מדברת את השפה שלך, גם ברוסית ובאנגלית לעולים חדשים.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {["אוניברסיטה", "מכללה", "מכינה", "פקולטה", "תואר ראשון", "תואר שני", "נ״ז", "מועד א׳", "מועד ב׳", "סמינריון", "פרויקט גמר", "עולים חדשים"].map((tag) => (
                <span key={tag} className="text-xs rounded-full border border-border bg-surface px-3 py-1 text-muted-foreground">{tag}</span>
              ))}
            </div>
          </div>
          <div className="glass-panel rounded-2xl p-6">
            <div className="text-xs text-muted-foreground mb-3">ידיעון לדוגמה · אוניברסיטת בר-אילן · לימודי מידע · תואר ראשון</div>
            <div className="space-y-2 text-sm max-h-[360px] overflow-y-auto">
              {[
                ["159", "מבנה המחשב ומערכות הפעלה", "שנה 1 · סמ׳ א׳ · 4 נ״ז"],
                ["615", "יסודות התכנות", "שנה 1 · סמ׳ א׳ · 5 נ״ז"],
                ["162", "מבני נתונים", "שנה 1 · סמ׳ ב׳ · 4 נ״ז · דרישת קדם: 615"],
                ["167", "מבוא לבינה מלאכותית", "שנה 2 · סמ׳ ב׳ · 4 נ״ז"],
                ["175", "פרויקט גמר א׳", "שנה 3 · סמ׳ א׳ · פרויקט"],
                ["191", "אתיקה ובינה מלאכותית", "סמינריון"],
              ].map(([n, t, m]) => (
                <div key={n} className="flex items-center gap-3 rounded-lg bg-surface p-3">
                  <div className="text-xs font-mono text-primary w-10">{n}</div>
                  <div className="flex-1">
                    <div className="font-medium">{t}</div>
                    <div className="text-[11px] text-muted-foreground">{m}</div>
                  </div>
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 bg-surface/40 border-t border-border">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <div className="max-w-2xl mb-14">
            <div className="text-xs uppercase tracking-widest text-primary mb-3">תמחור</div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">התחילו חינם. שדרגו לפני מבחנים.</h2>
          </div>
          <div className="grid md:grid-cols-4 gap-4">
            {[
              { n: "Free", p: "₪0", d: "סילבוס אחד, בחנים והערות מוגבלים.", c: "התחל בחינם" },
              { n: "Student Pro", p: "₪29/חודש", d: "קורסים ללא הגבלה, מאיץ למידה, גרף ידע, מורה AI.", c: "שדרוג", h: true },
              { n: "Exam Boost", p: "₪49 חד״פ", d: "חבילת הכנה למועד אחד: תכנית, בחנים, סיכומים.", c: "הפעל" },
              { n: "Olim Pack", p: "₪19/חודש", d: "פישוט עברית אקדמית + הסברים ברוסית וטרמינולוגיה.", c: "הצטרפות" },
            ].map((p) => (
              <div key={p.n} className={`rounded-xl p-6 ${p.h ? "gradient-primary text-primary-foreground shadow-glow" : "glass-panel"}`}>
                <div className="font-semibold">{p.n}</div>
                <div className="mt-2 text-3xl font-bold">{p.p}</div>
                <div className={`mt-2 text-sm ${p.h ? "opacity-90" : "text-muted-foreground"}`}>{p.d}</div>
                <Button className={`mt-6 w-full ${p.h ? "bg-background/20 hover:bg-background/30 text-primary-foreground" : ""}`} variant={p.h ? "default" : "outline"}>{p.c}</Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-10">
        <div className="mx-auto max-w-7xl px-4 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div>© 2026 Lamdan AI · למדן AI – כל הזכויות שמורות</div>
          <div className="flex gap-4">
            <a href="#" className="hover:text-foreground">פרטיות</a>
            <a href="#" className="hover:text-foreground">תנאים</a>
            <a href="#" className="hover:text-foreground">צור קשר</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
