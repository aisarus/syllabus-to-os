import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { useApp } from "@/lib/app-context";
import type { Lang } from "@/lib/i18n";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { checkAIStatus, type AIStatus } from "@/lib/ai";
import { PARSER_VERSION } from "@/lib/syllabus-parser";

export const Route = createFileRoute("/app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { t, lang, setLang, theme, setTheme } = useApp();
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);
  useEffect(() => {
    checkAIStatus(true).then(setAiStatus).catch(() =>
      setAiStatus({ ok: false, provider: "lovable-ai-gateway", configured: false, model: null }),
    );
  }, []);
  const configured = aiStatus?.configured ?? false;

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
            <span className={`text-xs rounded px-2 py-0.5 ${configured ? "bg-green-500/15 text-green-300" : "bg-yellow-500/15 text-yellow-300"}`}>
              {t.aiStatus}: {configured ? `${aiStatus?.model ?? ""}` : t.syllabusAINotConnected}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="text-muted-foreground">{t.aiProvider}</div><div>Lovable AI</div>
            <div className="text-muted-foreground">{t.aiConfigured}</div><div>{configured ? t.yes : t.no}</div>
            <div className="text-muted-foreground">{t.aiModel}</div><div>{aiStatus?.model ?? "—"}</div>
          </div>
          <p className="text-xs text-muted-foreground">{t.aiExplanation}</p>
          <div>
            <Label className="text-xs">{t.serverEndpoint}</Label>
            <Input disabled value="/api/ai/parse-syllabus" readOnly />
          </div>
          <p className="text-[11px] text-muted-foreground">{t.noKeyInFrontend}</p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-6 space-y-2">
          <h2 className="text-sm font-semibold">{t.syllabusParserDiag}</h2>
          <p className="text-xs"><span className="text-muted-foreground">{t.syllabusParserVersion}:</span> {PARSER_VERSION}</p>
          <p className="text-xs text-muted-foreground">{t.syllabusSupportedFormats}</p>
          <div className="pt-2 border-t border-border">
            <h3 className="text-xs font-semibold mb-1">{t.aiActionsTitle}</h3>
            <ul className="text-xs space-y-0.5">
              <li>· {t.aiActionSyllabus}: <span className={configured ? "text-green-400" : "text-muted-foreground"}>{configured ? t.statusEnabled : t.statusDisabled}</span></li>
              <li>· {t.aiActionStudyGen}: <span className="text-muted-foreground">{t.statusNotImplemented}</span></li>
            </ul>
          </div>
        </div>

        <p className="text-xs text-muted-foreground pt-2">
          Lamdan · v1 · Local personal study workspace. Data is stored only in your browser.
        </p>
      </div>
    </div>
  );
}
