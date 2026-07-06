import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { useApp } from "@/lib/app-context";
import type { Lang } from "@/lib/i18n";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { isAIConnected } from "@/lib/ai";

export const Route = createFileRoute("/app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { t, lang, setLang, theme, setTheme } = useApp();
  const aiConnected = isAIConnected();
  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader title={t.settings} />
      <div className="space-y-4">
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
        </div>

        <div className="rounded-lg border border-border bg-surface p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t.aiConnection}</h2>
            <span className={`text-xs rounded px-2 py-0.5 ${aiConnected ? "bg-green-500/15 text-green-300" : "bg-yellow-500/15 text-yellow-300"}`}>
              {t.aiStatus}: {aiConnected ? "OK" : t.aiStatusNotConnected}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{t.aiExplanation}</p>
          <div>
            <Label className="text-xs">{t.serverEndpoint}</Label>
            <Input disabled placeholder="https://…" />
          </div>
          <p className="text-[11px] text-muted-foreground">{t.noKeyInFrontend}</p>
        </div>

        <p className="text-xs text-muted-foreground pt-2">
          Lamdan · v1 · Local personal study workspace. Data is stored only in your browser.
        </p>
      </div>
    </div>
  );
}
