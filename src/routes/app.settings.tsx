import { createFileRoute } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApp } from "@/lib/app-context";
import { checkAIStatus, type AIStatus } from "@/lib/ai";
import type { Lang } from "@/lib/i18n";
import { PARSER_VERSION } from "@/lib/syllabus-parser";

export const Route = createFileRoute("/app/settings")({
  component: SettingsPage,
});

type DiagnosticState = "loading" | "ready" | "error";

function SettingsPage() {
  const { t, lang, setLang, theme, setTheme } = useApp();
  const isRu = lang === "ru";
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);
  const [diagnosticState, setDiagnosticState] = useState<DiagnosticState>("loading");

  const refreshStatus = useCallback(async () => {
    setDiagnosticState("loading");
    try {
      const status = await checkAIStatus(true);
      setAiStatus(status);
      setDiagnosticState(status.ok ? "ready" : "error");
    } catch (error) {
      setAiStatus({
        ok: false,
        provider: "lovable-ai-gateway",
        configured: false,
        model: null,
        error: error instanceof Error ? error.message : String(error),
      });
      setDiagnosticState("error");
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const configured = diagnosticState === "ready" && aiStatus?.configured === true;
  const statusCopy =
    diagnosticState === "loading"
      ? isRu
        ? "Проверяю…"
        : "Checking…"
      : diagnosticState === "error"
        ? isRu
          ? "Ошибка проверки"
          : "Check failed"
        : configured
          ? aiStatus?.model || (isRu ? "Подключён" : "Connected")
          : isRu
            ? "Не подключён"
            : "Not connected";

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        title={t.settings}
        subtitle={
          isRu
            ? "Язык, внешний вид и честная диагностика подключений."
            : "Language, appearance, and honest connection diagnostics."
        }
      />
      <div className="space-y-4">
        <section className="rounded-lg border border-border bg-surface p-6 space-y-4">
          <div>
            <Label htmlFor="settings-language">{t.language}</Label>
            <Select value={lang} onValueChange={(value) => setLang(value as Lang)}>
              <SelectTrigger id="settings-language" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ru">Русский</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="settings-theme">{t.theme}</Label>
            <Select value={theme} onValueChange={(value) => setTheme(value as "dark" | "light")}>
              <SelectTrigger id="settings-theme" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dark">{t.dark}</SelectItem>
                <SelectItem value="light">{t.light}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-surface p-6 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold">{t.aiConnection}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {isRu
                  ? "Статус запрашивается у серверного AI-маршрута; ключи не хранятся в браузере."
                  : "Status comes from the server AI route; keys are never stored in the browser."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                role="status"
                aria-live="polite"
                aria-atomic="true"
                className={`rounded px-2 py-1 text-xs ${
                  diagnosticState === "loading"
                    ? "bg-sky-500/15 text-sky-300"
                    : diagnosticState === "error"
                      ? "bg-red-500/15 text-red-300"
                      : configured
                        ? "bg-green-500/15 text-green-300"
                        : "bg-yellow-500/15 text-yellow-300"
                }`}
              >
                {statusCopy}
              </span>
              <Button
                size="icon"
                variant="outline"
                disabled={diagnosticState === "loading"}
                aria-label={isRu ? "Проверить снова" : "Check again"}
                onClick={() => void refreshStatus()}
              >
                <RefreshCw
                  className={`h-4 w-4 ${diagnosticState === "loading" ? "animate-spin" : ""}`}
                />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-2 text-xs">
            <div className="text-muted-foreground">{t.aiProvider}</div>
            <div>Lovable AI Gateway</div>
            <div className="text-muted-foreground">{t.aiConfigured}</div>
            <div>{diagnosticState === "loading" ? "—" : configured ? t.yes : t.no}</div>
            <div className="text-muted-foreground">{t.aiModel}</div>
            <div>{diagnosticState === "loading" ? "—" : (aiStatus?.model ?? "—")}</div>
          </div>

          {diagnosticState === "error" && (
            <div className="rounded-md border border-red-500/25 bg-red-500/5 p-3 text-xs text-red-200">
              <strong>{isRu ? "Не удалось проверить AI" : "AI status check failed"}</strong>
              <p className="mt-1 break-words text-muted-foreground">
                {aiStatus?.error ||
                  (isRu
                    ? "Сервер не вернул понятную ошибку."
                    : "The server returned no readable error.")}
              </p>
            </div>
          )}

          {!configured && diagnosticState === "ready" && (
            <p className="rounded-md border border-yellow-500/20 bg-yellow-500/5 p-3 text-xs text-yellow-100">
              {isRu
                ? "Редакторы, импорт и ручная работа доступны. AI-кнопки честно сообщат, что серверная модель не настроена."
                : "Editors, imports, and manual work remain available. AI actions will honestly report that the server model is not configured."}
            </p>
          )}
        </section>

        <section className="rounded-lg border border-border bg-surface p-6 space-y-2">
          <h2 className="text-sm font-semibold">{t.syllabusParserDiag}</h2>
          <p className="text-xs">
            <span className="text-muted-foreground">{t.syllabusParserVersion}:</span>{" "}
            {PARSER_VERSION}
          </p>
          <p className="text-xs text-muted-foreground">{t.syllabusSupportedFormats}</p>
          <div className="pt-3 border-t border-border">
            <h3 className="text-xs font-semibold mb-2">{t.aiActionsTitle}</h3>
            <ul className="grid gap-1 text-xs sm:grid-cols-2">
              {[
                t.aiActionSyllabus,
                t.aiGenerateNote,
                t.aiGenerateFlashcards,
                t.aiGenerateQuiz,
                t.aiGeneratePresentation,
                t.aiSimplifyText,
                t.aiTranslateText,
                t.aiBreakDownAssignment,
                t.aiExplainTopic,
              ].map((label) => (
                <li key={label} className="rounded border border-border bg-background px-2 py-1.5">
                  <span>{label}</span>
                  <span
                    className={`ms-1 ${configured ? "text-green-400" : "text-muted-foreground"}`}
                  >
                    · {configured ? t.statusEnabled : t.statusDisabled}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <p className="text-xs text-muted-foreground pt-2">
          {isRu
            ? "Lamdan · локальное персональное учебное пространство. Данные хранятся только в этом браузере, пока ты сам не экспортируешь резервную копию."
            : "Lamdan · local personal study workspace. Data stays in this browser unless you export a backup yourself."}
        </p>
      </div>
    </div>
  );
}
