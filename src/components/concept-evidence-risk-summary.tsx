import { AlertTriangle, BrainCircuit, CheckCircle2, Clock3 } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { summarizeConceptEvidence, type ForgettingRisk } from "@/lib/concept-evidence";
import { useConceptEvidenceData } from "@/lib/concept-store";

export function ConceptEvidenceRiskSummary({ courseId }: { courseId: string }) {
  const { lang } = useApp();
  const isRu = lang === "ru";
  const data = useConceptEvidenceData();
  const concepts = data.concepts.filter((concept) => concept.courseId === courseId);
  const rows = concepts.map((concept) => ({
    concept,
    summary: summarizeConceptEvidence(
      concept,
      data.evidenceEvents.filter((event) => event.conceptId === concept.id),
    ),
  }));
  const risky = rows
    .filter((row) => row.summary.forgettingRisk === "high" || row.summary.forgettingRisk === "medium")
    .sort((left, right) => riskRank(right.summary.forgettingRisk) - riskRank(left.summary.forgettingRisk));

  if (concepts.length === 0) return null;

  return (
    <section className="mx-auto mt-5 max-w-[1440px] rounded-xl border border-border bg-surface p-4 md:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-primary">
            <Clock3 className="h-4 w-4" />
            {isRu ? "Риск забывания" : "Forgetting risk"}
          </div>
          <h2 className="mt-2 font-serif text-xl font-semibold">
            {risky.length > 0
              ? isRu
                ? "Есть понятия, которые пора снова проверить"
                : "Some concepts need fresh evidence"
              : isRu
                ? "Срочного повторения по evidence пока нет"
                : "No evidence-based urgent review yet"}
          </h2>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {isRu
              ? "Риск зависит только от времени после последнего успешного оцениваемого события. Просмотр файла, время в приложении и нейтральная попытка теста его не уменьшают."
              : "Risk depends only on time since the latest successful scored event. File views, time in the app and neutral quiz attempts do not reduce it."}
          </p>
        </div>
        <div className="grid shrink-0 grid-cols-3 gap-2 text-center text-xs">
          <RiskCount label={isRu ? "Высокий" : "High"} value={countRisk(rows, "high")} icon={AlertTriangle} />
          <RiskCount label={isRu ? "Средний" : "Medium"} value={countRisk(rows, "medium")} icon={Clock3} />
          <RiskCount label={isRu ? "Низкий" : "Low"} value={countRisk(rows, "low")} icon={CheckCircle2} />
        </div>
      </div>

      {risky.length > 0 && (
        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {risky.map(({ concept, summary }) => (
            <div key={concept.id} className="rounded-lg border border-border bg-background p-3">
              <div className="flex items-start gap-2">
                {summary.forgettingRisk === "high" ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
                ) : (
                  <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-yellow-300" />
                )}
                <div className="min-w-0">
                  <strong className="block truncate text-sm">{concept.title}</strong>
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    {riskCopy(summary.forgettingRisk, isRu)} · {latestSuccessCopy(summary.latestSuccessAt, isRu)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {risky.length === 0 && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
          <BrainCircuit className="h-4 w-4 shrink-0" />
          {isRu
            ? "Понятия без успешного evidence не помечаются как «низкий риск» — для них сначала нужна проверка знания."
            : "Concepts without successful evidence are not labeled low-risk; they need a knowledge check first."}
        </div>
      )}
    </section>
  );
}

function RiskCount({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Clock3;
}) {
  return (
    <div className="min-w-20 rounded-lg border border-border bg-background p-2.5">
      <Icon className="mx-auto h-3.5 w-3.5 text-muted-foreground" />
      <strong className="mt-1 block font-mono text-sm">{value}</strong>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

function countRisk(
  rows: Array<{ summary: ReturnType<typeof summarizeConceptEvidence> }>,
  risk: ForgettingRisk,
): number {
  return rows.filter((row) => row.summary.forgettingRisk === risk).length;
}

function riskRank(risk: ForgettingRisk): number {
  return { none: 0, low: 1, medium: 2, high: 3 }[risk];
}

function riskCopy(risk: ForgettingRisk, isRu: boolean): string {
  const copy: Record<ForgettingRisk, [string, string]> = {
    none: ["Нет успешного evidence", "No successful evidence"],
    low: ["Низкий риск", "Low risk"],
    medium: ["Средний риск", "Medium risk"],
    high: ["Высокий риск", "High risk"],
  };
  return copy[risk][isRu ? 0 : 1];
}

function latestSuccessCopy(value: number | undefined, isRu: boolean): string {
  if (!value) return isRu ? "успехов ещё нет" : "no success yet";
  return `${isRu ? "последний успех" : "latest success"}: ${new Date(value).toLocaleDateString(
    isRu ? "ru-RU" : "en-GB",
  )}`;
}
