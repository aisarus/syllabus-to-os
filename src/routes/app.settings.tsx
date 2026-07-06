import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { useApp } from "@/lib/app-context";
import type { Lang } from "@/lib/i18n";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { t, lang, setLang, theme, setTheme } = useApp();
  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader title={t.settings} />
      <div className="rounded-lg border border-border bg-surface p-6 space-y-4">
        <div>
          <Label>{t.language}</Label>
          <Select value={lang} onValueChange={(v) => setLang(v as Lang)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ru">Русский</SelectItem>
              <SelectItem value="en">English</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>{t.theme}</Label>
          <Select value={theme} onValueChange={(v) => setTheme(v as "dark" | "light")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="dark">{t.dark}</SelectItem>
              <SelectItem value="light">{t.light}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground pt-4 border-t border-border">
          Lamdan · v1 · Local personal study workspace. Data is stored only in your browser.
        </p>
      </div>
    </div>
  );
}
