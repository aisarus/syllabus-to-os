import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  FileUp,
  FileJson,
  Trash2,
  CheckCircle2,
  Sparkles,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Wand2,
} from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApp } from "@/lib/app-context";
import { store, useData, type Course, type Topic } from "@/lib/store";
import {
  parseWorkbookToSyllabusDraft,
  readSheetRows,
  normalizedTitle,
  PARSER_VERSION,
  type ParsedSyllabusDraft,
  type ParsedCourseDraft,
  type IgnoredRow,
} from "@/lib/syllabus-parser";
import { checkAIStatus, parseSyllabusWithAI } from "@/lib/ai";

export const Route = createFileRoute("/app/import-syllabus")({
  component: ImportSyllabusPage,
});

// =================================================================
// Page shell
// =================================================================

function ImportSyllabusPage() {
  const { t } = useApp();
  const data = useData();
  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader title={t.importSyllabus} subtitle={t.importSyllabusIntro} />
      <Tabs defaultValue="auto" className="w-full">
        <TabsList>
          <TabsTrigger value="auto">
            <Wand2 className="h-4 w-4 me-1" />
            {t.syllabusAutoParse}
          </TabsTrigger>
          <TabsTrigger value="json">
            <FileJson className="h-4 w-4 me-1" />
            {t.syllabusTabJson}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="auto" className="mt-4">
          <AutoParseFlow />
        </TabsContent>
        <TabsContent value="json" className="mt-4">
          <JsonImporter />
        </TabsContent>
      </Tabs>

      <div className="mt-10">
        <h2 className="text-lg font-semibold mb-3">{t.syllabusHistory}</h2>
        {data.syllabusImports.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.syllabusHistoryEmpty}</p>
        ) : (
          <div className="space-y-2">
            {data.syllabusImports.map((s) => (
              <div
                key={s.id}
                className="rounded-md border border-border bg-surface p-3 flex flex-wrap items-center gap-3 text-sm"
              >
                <span className="uppercase text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">
                  {s.source}
                </span>
                <span className="font-medium">{s.programName ?? "—"}</span>
                {s.fileName && (
                  <span className="text-muted-foreground text-xs">{s.fileName}</span>
                )}
                {s.sheetName && (
                  <span className="text-muted-foreground text-xs">· {s.sheetName}</span>
                )}
                <span className="text-muted-foreground text-xs">
                  {s.courseIds.length} · {s.topicIds.length}
                </span>
                <span className="ms-auto text-muted-foreground text-xs">
                  {new Date(s.createdAt).toLocaleString()}
                </span>
                <button
                  className="p-1 hover:text-destructive"
                  aria-label="Delete"
                  onClick={() => store.deleteSyllabusImport(s.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// =================================================================
// Auto-parse flow
// =================================================================

type ParserStep =
  | "reading"
  | "sheets"
  | "headers"
  | "sections"
  | "courses"
  | "cleaning"
  | "draft";

const ALL_STEPS: ParserStep[] = ["reading", "sheets", "headers", "sections", "courses", "cleaning", "draft"];

function AutoParseFlow() {
  const { t } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState("");
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [draft, setDraft] = useState<ParsedSyllabusDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [activeStep, setActiveStep] = useState<ParserStep | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // AI state
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

  const runParser = useCallback(async (wb: XLSX.WorkBook, name: string) => {
    setBusy(true);
    setDraft(null);
    try {
      for (const step of ALL_STEPS) {
        setActiveStep(step);
        // Yield to the UI so the spinner is visible for large files.
        await new Promise((r) => setTimeout(r, 30));
      }
      const d = parseWorkbookToSyllabusDraft(wb, { sourceFileName: name });
      setDraft(d);
      if (d.courses.length === 0) toast.error(t.syllabusNoCoursesDetected);
      // check AI availability quietly
      checkAIStatus().then((s) => setAiConfigured(s.configured)).catch(() => setAiConfigured(false));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      setActiveStep(null);
    }
  }, [t.syllabusNoCoursesDetected]);

  const onFile = useCallback(async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      setFileName(file.name);
      setWorkbook(wb);
      await runParser(wb, file.name);
    } catch (e) {
      toast.error((e as Error).message || t.syllabusUnsupportedFile);
    }
  }, [runParser, t.syllabusUnsupportedFile]);

  const runAI = useCallback(async () => {
    if (!workbook || !draft) return;
    setAiBusy(true);
    try {
      const sheets = workbook.SheetNames.map((n) => ({ name: n, rows: readSheetRows(workbook, n) }));
      const res = await parseSyllabusWithAI({
        fileName,
        sheets,
        deterministicDraft: draft,
        ignoredRows: draft.ignoredRows,
        locale: "ru",
      });
      if (!res.ok) {
        toast.error(res.message || t.syllabusAIFailed);
      } else {
        setDraft({ ...res.data, parserType: "ai_assisted" });
        toast.success("Gemini ✓");
      }
    } finally {
      setAiBusy(false);
    }
  }, [workbook, draft, fileName, t.syllabusAIFailed]);

  return (
    <div className="space-y-6">
      {/* Step 1: Upload */}
      <div
        className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "border-border bg-surface"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
      >
        <FileUp className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <h3 className="font-semibold text-base">{t.syllabusUploadTitle}</h3>
        <p className="text-sm text-muted-foreground max-w-xl mx-auto mt-1">
          {t.syllabusUploadHelp}
        </p>
        <div className="mt-4 flex items-center justify-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv,.json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = "";
            }}
          />
          <Button onClick={() => fileRef.current?.click()}>
            <FileUp className="h-4 w-4 me-1" />
            {t.syllabusChooseFile}
          </Button>
          <span className="text-xs text-muted-foreground">{t.syllabusOr}</span>
          <span className="text-xs text-muted-foreground">{t.syllabusDropHere}</span>
        </div>
        {fileName && (
          <p className="text-xs text-muted-foreground mt-3">
            <FileUp className="h-3 w-3 inline me-1" />
            {fileName}
          </p>
        )}
      </div>

      {/* Step 2: Parsing steps */}
      {busy && (
        <div className="rounded-lg border border-border bg-surface p-4">
          <h3 className="font-semibold text-sm mb-3">{t.syllabusParsing}</h3>
          <ul className="text-sm space-y-1">
            {ALL_STEPS.map((s) => {
              const label = stepLabel(t, s);
              const done = ALL_STEPS.indexOf(s) < ALL_STEPS.indexOf(activeStep ?? "reading");
              const active = s === activeStep;
              return (
                <li key={s} className={active ? "text-primary" : done ? "text-muted-foreground" : "text-muted-foreground/60"}>
                  {done ? "✓" : active ? "…" : "·"} {label}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Step 3+4: Clean review + Import */}
      {draft && !busy && (
        <>
          <DraftSummary draft={draft} />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={runAI}
              disabled={!aiConfigured || aiBusy}
              title={aiConfigured ? "" : t.syllabusAINotConnected}
            >
              <Sparkles className="h-4 w-4 me-1" />
              {aiBusy ? t.syllabusAIRunning : aiConfigured ? t.syllabusAIImprove : t.syllabusAINotConnected}
            </Button>
            <p className="text-xs text-muted-foreground">{t.syllabusAIHint}</p>
          </div>

          <DraftEditor draft={draft} onChange={setDraft} />

          <IgnoredRowsPanel
            draft={draft}
            onConvert={(row) => {
              const newCourse: ParsedCourseDraft = {
                id: "crs_manual_" + row.id,
                include: true,
                title: row.cells.find((c) => c && c.length > 3) ?? "(untitled)",
                topics: [],
                confidence: 0.5,
                warnings: ["converted_from_ignored"],
                source: {
                  sheetName: row.sheetName,
                  rowIndex: row.rowIndex,
                  originalCells: row.cells,
                },
              };
              setDraft({
                ...draft,
                courses: [...draft.courses, newCourse],
                ignoredRows: draft.ignoredRows.filter((r) => r.id !== row.id),
              });
            }}
            onIgnore={(row) => {
              setDraft({ ...draft, ignoredRows: draft.ignoredRows.filter((r) => r.id !== row.id) });
            }}
          />

          <ImportPanel draft={draft} fileName={fileName} onDone={() => { setDraft(null); setWorkbook(null); setFileName(""); }} />
        </>
      )}

      {/* Advanced fallback */}
      {workbook && !busy && (
        <div className="rounded-lg border border-border bg-surface">
          <button
            className="w-full flex items-center gap-2 p-3 text-sm font-semibold hover:bg-muted/30"
            onClick={() => setAdvancedOpen((o) => !o)}
          >
            {advancedOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            {t.syllabusAdvancedMapping}
          </button>
          {advancedOpen && <AdvancedMapping workbook={workbook} fileName={fileName} />}
        </div>
      )}
    </div>
  );
}

function stepLabel(t: ReturnType<typeof useApp>["t"], s: ParserStep): string {
  switch (s) {
    case "reading": return t.syllabusStepReading;
    case "sheets": return t.syllabusStepDetectSheets;
    case "headers": return t.syllabusStepDetectHeaders;
    case "sections": return t.syllabusStepDetectSections;
    case "courses": return t.syllabusStepDetectCourses;
    case "cleaning": return t.syllabusStepCleaning;
    case "draft": return t.syllabusStepBuildDraft;
  }
}

// =================================================================
// Draft summary + editor
// =================================================================

function DraftSummary({ draft }: { draft: ParsedSyllabusDraft }) {
  const { t } = useApp();
  const pct = Math.round((draft.confidence || 0) * 100);
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <div>
          <span className="text-muted-foreground text-xs">{t.syllabusDetectedSheet}</span>
          <div className="font-medium">{draft.detectedSheetName ?? "—"}</div>
        </div>
        <div>
          <span className="text-muted-foreground text-xs">{t.syllabusParserConfidence}</span>
          <div className="font-medium">{pct}%</div>
        </div>
        <div>
          <span className="text-muted-foreground text-xs">{t.syllabusDetectedSemesters}</span>
          <div className="font-medium">{draft.stats.detectedSemesters}</div>
        </div>
        <div>
          <span className="text-muted-foreground text-xs">{t.syllabusDetectedCourses}</span>
          <div className="font-medium">{draft.stats.detectedCourses}</div>
        </div>
        <div>
          <span className="text-muted-foreground text-xs">{t.syllabusWarnings}</span>
          <div className="font-medium flex items-center gap-1">
            {draft.stats.warnings > 0 && <AlertTriangle className="h-3 w-3 text-yellow-500" />}
            {draft.stats.warnings}
          </div>
        </div>
        <div className="ms-auto text-[11px] text-muted-foreground">
          {draft.parserType === "ai_assisted" ? "AI-assisted" : "deterministic"} · {draft.parserVersion}
        </div>
      </div>
      {draft.warnings.length > 0 && (
        <ul className="mt-3 text-xs text-muted-foreground list-disc ms-5">
          {draft.warnings.map((w) => <li key={w}>{w.replace(/_/g, " ")}</li>)}
        </ul>
      )}
    </div>
  );
}

function DraftEditor({ draft, onChange }: { draft: ParsedSyllabusDraft; onChange: (d: ParsedSyllabusDraft) => void }) {
  const { t } = useApp();

  const groups = useMemo(() => {
    // Group by semesterId (or 'no-semester')
    const map = new Map<string, ParsedCourseDraft[]>();
    for (const c of draft.courses) {
      const key = c.semesterId ?? "no-semester";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return draft.semesters
      .map((s) => ({ semester: s, courses: map.get(s.id) ?? [] }))
      .concat(
        map.has("no-semester")
          ? [{
              semester: { id: "no-semester", title: t.none, order: 999 },
              courses: map.get("no-semester")!,
            }]
          : [],
      );
  }, [draft, t.none]);

  const updateCourse = (id: string, patch: Partial<ParsedCourseDraft>) => {
    onChange({ ...draft, courses: draft.courses.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  };
  const deleteCourse = (id: string) => {
    onChange({ ...draft, courses: draft.courses.filter((c) => c.id !== id) });
  };

  return (
    <div className="space-y-4">
      {/* Program-level fields */}
      <div className="rounded-lg border border-border bg-surface p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">{t.syllabusDetectedProgramName}</label>
          <Input
            value={draft.programName ?? ""}
            onChange={(e) => onChange({ ...draft, programName: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">{t.syllabusDetectedInstitution}</label>
          <Input
            value={draft.institution ?? ""}
            onChange={(e) => onChange({ ...draft, institution: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">{t.syllabusDetectedDegree}</label>
          <Input
            value={draft.degree ?? ""}
            onChange={(e) => onChange({ ...draft, degree: e.target.value })}
          />
        </div>
      </div>

      {groups.map((g) => (
        <div key={g.semester.id} className="rounded-lg border border-border bg-surface">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-sm">{g.semester.title}</h4>
              <p className="text-xs text-muted-foreground">
                {g.courses.length} {t.syllabusRowsGroup}
                {g.semester.creditsTotal != null && ` · ${g.semester.creditsTotal} ${t.syllabusTotalCredits}`}
              </p>
            </div>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-2 py-1 text-start w-8">{t.syllabusIncludeRow}</th>
                  <th className="px-2 py-1 text-start w-20">{t.courseNumber}</th>
                  <th className="px-2 py-1 text-start">{t.title}</th>
                  <th className="px-2 py-1 text-start w-16">{t.credits}</th>
                  <th className="px-2 py-1 text-start">{t.instructor}</th>
                  <th className="px-2 py-1 text-start w-20">{t.type}</th>
                  <th className="px-2 py-1 text-start w-24">{t.notes}</th>
                  <th className="px-2 py-1 text-start w-20"></th>
                </tr>
              </thead>
              <tbody>
                {g.courses.map((c) => (
                  <tr
                    key={c.id}
                    className={`border-t border-border ${c.confidence < 0.6 ? "bg-yellow-500/5" : ""}`}
                    title={c.confidence < 0.6 ? t.syllabusLowConfidence : ""}
                  >
                    <td className="px-2 py-1 align-top">
                      <Checkbox
                        checked={c.include}
                        onCheckedChange={(v) => updateCourse(c.id, { include: Boolean(v) })}
                      />
                    </td>
                    <td className="px-2 py-1 align-top">
                      <Input className="h-7 text-xs" value={c.number ?? ""} onChange={(e) => updateCourse(c.id, { number: e.target.value })} />
                    </td>
                    <td className="px-2 py-1 align-top">
                      <Input className="h-7 text-xs" value={c.title} onChange={(e) => updateCourse(c.id, { title: e.target.value })} />
                    </td>
                    <td className="px-2 py-1 align-top">
                      <Input
                        className="h-7 text-xs w-14"
                        value={c.credits ?? ""}
                        onChange={(e) => {
                          const v = e.target.value.replace(",", ".");
                          const n = v === "" ? undefined : Number(v);
                          updateCourse(c.id, { credits: Number.isFinite(n as number) ? (n as number) : undefined });
                        }}
                      />
                    </td>
                    <td className="px-2 py-1 align-top">
                      <Input className="h-7 text-xs" value={c.instructor ?? ""} onChange={(e) => updateCourse(c.id, { instructor: e.target.value })} />
                    </td>
                    <td className="px-2 py-1 align-top">
                      <Input className="h-7 text-xs" value={c.type ?? ""} onChange={(e) => updateCourse(c.id, { type: e.target.value })} />
                    </td>
                    <td className="px-2 py-1 align-top">
                      <Input className="h-7 text-xs" value={c.notes ?? ""} onChange={(e) => updateCourse(c.id, { notes: e.target.value })} />
                    </td>
                    <td className="px-2 py-1 align-top text-end">
                      <button
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="delete"
                        onClick={() => deleteCourse(c.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

// =================================================================
// Ignored rows inspector
// =================================================================

function IgnoredRowsPanel({
  draft,
  onConvert,
  onIgnore,
}: {
  draft: ParsedSyllabusDraft;
  onConvert: (row: IgnoredRow) => void;
  onIgnore: (row: IgnoredRow) => void;
}) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  if (draft.ignoredRows.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-surface">
      <button
        className="w-full flex items-center gap-2 p-3 text-sm font-semibold hover:bg-muted/30"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        {t.syllabusIgnoredRows} · {draft.ignoredRows.length}
      </button>
      {open && (
        <div className="p-3 space-y-2">
          <p className="text-xs text-muted-foreground">{t.syllabusIgnoredRowsHelp}</p>
          <div className="max-h-72 overflow-auto border border-border rounded">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 sticky top-0">
                <tr>
                  <th className="px-2 py-1 text-start w-16">{t.syllabusSourceRow}</th>
                  <th className="px-2 py-1 text-start w-32">{t.reason}</th>
                  <th className="px-2 py-1 text-start">{t.syllabusViewCells}</th>
                  <th className="px-2 py-1 text-start w-48"></th>
                </tr>
              </thead>
              <tbody>
                {draft.ignoredRows.map((r) => (
                  <tr key={r.id} className="border-t border-border align-top">
                    <td className="px-2 py-1 text-muted-foreground">
                      {r.sheetName}:{r.rowIndex + 1}
                    </td>
                    <td className="px-2 py-1">{reasonLabel(t, r)}</td>
                    <td className="px-2 py-1 text-muted-foreground truncate max-w-xs">
                      {r.cells.filter(Boolean).join(" | ")}
                    </td>
                    <td className="px-2 py-1 text-end space-x-2">
                      <Button size="sm" variant="outline" onClick={() => onConvert(r)}>
                        {t.syllabusConvertToCourse}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => onIgnore(r)}>
                        {t.syllabusIgnorePermanently}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function reasonLabel(t: ReturnType<typeof useApp>["t"], r: IgnoredRow): string {
  switch (r.detectedType) {
    case "empty_row": return t.syllabusReasonEmpty;
    case "header_row": return t.syllabusReasonHeader;
    case "semester_section_row": return t.syllabusReasonSection;
    case "total_credits_row": return t.syllabusReasonTotal;
    case "notes_row": return t.syllabusReasonNotes;
    default:
      if (r.reason === "no_title_detected") return t.syllabusReasonNoTitle;
      return t.syllabusReasonUnknown;
  }
}

// =================================================================
// Import panel
// =================================================================

function ImportPanel({
  draft,
  fileName,
  onDone,
}: {
  draft: ParsedSyllabusDraft;
  fileName: string;
  onDone: () => void;
}) {
  const { t } = useApp();
  const data = useData();
  const [destMode, setDestMode] = useState<"new" | "merge" | "replace">("new");
  const [programName, setProgramName] = useState(draft.programName ?? "");
  const [institution, setInstitution] = useState(draft.institution ?? "");
  const [existingProgramId, setExistingProgramId] = useState("");

  const run = () => {
    const picked = draft.courses.filter((c) => c.include);
    if (picked.length === 0) { toast.error(t.syllabusNoRowsPicked); return; }

    let programId: string | undefined;
    let programNameFinal: string | undefined;

    if (destMode === "new") {
      if (!programName.trim()) { toast.error(t.programName); return; }
      const p = store.createProgram({
        name: programName.trim(),
        institution: institution.trim(),
        degree: draft.degree ?? "",
        years: Math.max(1, Math.min(6, new Set(draft.semesters.map((s) => s.year).filter(Boolean)).size || 3)),
        semesters: draft.semesters.map((s) => s.title),
      });
      programId = p.id;
      programNameFinal = p.name;
    } else {
      if (!existingProgramId) { toast.error(t.programName); return; }
      programId = existingProgramId;
      programNameFinal = data.programs.find((p) => p.id === existingProgramId)?.name;
      if (destMode === "replace") {
        // Delete all existing courses under this program
        const doomed = data.courses.filter((c) => c.programId === programId);
        for (const c of doomed) store.deleteCourse(c.id);
      }
    }

    // Duplicate detection against existing courses in target program
    const existingInProgram = data.courses.filter((c) => c.programId === programId);
    const createdCourses: Course[] = [];
    const createdTopics: Topic[] = [];
    let skipped = 0, updated = 0;

    picked.forEach((row, idx) => {
      const dup = existingInProgram.find((ec) => {
        if (row.number && ec.number && row.number === ec.number) return true;
        if (normalizedTitle(ec.title) === normalizedTitle(row.title)) return true;
        return false;
      });

      if (dup && destMode === "merge") {
        // Update existing with any non-empty fields, do not overwrite user data blindly
        store.updateCourse(dup.id, {
          credits: dup.credits ?? row.credits,
          instructor: dup.instructor || row.instructor,
          type: dup.type || row.type,
          description: dup.description || row.description,
          semester: dup.semester || row.semester,
          number: dup.number || row.number,
        });
        updated++;
        return;
      }
      if (dup && destMode === "replace") {
        // structure was already cleared above
      }
      if (dup && destMode === "new") skipped++; // shouldn't happen (new program is empty)

      const c = store.createCourse({
        programId,
        title: row.title.trim(),
        originalTitle: row.originalTitle,
        number: row.number,
        semester: row.semester,
        credits: row.credits,
        instructor: row.instructor,
        type: row.type,
        description: row.description,
        status: "not_started",
        order: idx,
      });
      createdCourses.push(c);
      row.topics.forEach((tt, ti) => {
        const topic = store.createTopic({
          courseId: c.id,
          title: tt,
          status: "not_started",
          order: ti,
        });
        createdTopics.push(topic);
      });
    });

    store.recordSyllabusImport({
      source: "xlsx",
      fileName,
      sheetName: draft.detectedSheetName,
      programId,
      programName: programNameFinal,
      courseIds: createdCourses.map((c) => c.id),
      topicIds: createdTopics.map((tp) => tp.id),
    });

    toast.success(
      `${t.syllabusImported}: +${createdCourses.length}${updated ? ` · ~${updated}` : ""}${skipped ? ` · skip ${skipped}` : ""}`,
    );
    onDone();
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
      <h4 className="font-semibold text-sm">{t.syllabusDestinationProgram}</h4>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={destMode === "new" ? "default" : "outline"} onClick={() => setDestMode("new")}>
          {t.syllabusReimportNew}
        </Button>
        <Button size="sm" variant={destMode === "merge" ? "default" : "outline"} onClick={() => setDestMode("merge")} disabled={data.programs.length === 0}>
          {t.syllabusReimportMerge}
        </Button>
        <Button size="sm" variant={destMode === "replace" ? "default" : "outline"} onClick={() => setDestMode("replace")} disabled={data.programs.length === 0}>
          {t.syllabusReimportReplace}
        </Button>
      </div>
      {destMode === "new" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input placeholder={t.programName} value={programName} onChange={(e) => setProgramName(e.target.value)} />
          <Input placeholder={t.institution} value={institution} onChange={(e) => setInstitution(e.target.value)} />
        </div>
      ) : (
        <Select value={existingProgramId} onValueChange={setExistingProgramId}>
          <SelectTrigger className="h-9 bg-background max-w-md">
            <SelectValue placeholder={t.programName} />
          </SelectTrigger>
          <SelectContent>
            {data.programs.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Button onClick={run}>
        <CheckCircle2 className="h-4 w-4 me-1" />
        {t.syllabusRunImport}
      </Button>
    </div>
  );
}

// =================================================================
// Advanced (manual) mapping — legacy behaviour, hidden by default
// =================================================================

type CourseField = "title" | "number" | "semester" | "credits" | "instructor" | "type" | "description";
type Mapping = Partial<Record<CourseField, number>>;
const COURSE_FIELDS: CourseField[] = ["title", "number", "semester", "credits", "instructor", "type", "description"];

function AdvancedMapping({ workbook, fileName }: { workbook: XLSX.WorkBook; fileName: string }) {
  const { t } = useApp();
  const data = useData();
  const [sheetName, setSheetName] = useState(workbook.SheetNames[0] ?? "");
  const [headerRow, setHeaderRow] = useState(1);
  const [mapping, setMapping] = useState<Mapping>({});
  const [preview, setPreview] = useState<ParsedCourseDraft[] | null>(null);
  const [programName, setProgramName] = useState("");
  const [institution, setInstitution] = useState("");
  const [existingProgramId, setExistingProgramId] = useState("");
  const [destMode, setDestMode] = useState<"new" | "existing">("new");

  const rows = useMemo(() => readSheetRows(workbook, sheetName), [workbook, sheetName]);
  const headers = rows[headerRow - 1] ?? [];
  const body = rows.slice(headerRow);

  const build = () => {
    if (mapping.title == null) { toast.error(t.syllabusTitleRequired); return; }
    const out: ParsedCourseDraft[] = [];
    body.forEach((r, i) => {
      const val = (f: CourseField) => (mapping[f] != null ? (r[mapping[f]!] ?? "").trim() : "");
      const title = val("title");
      if (!title) return;
      const creditsStr = val("credits");
      const credits = creditsStr ? Number(creditsStr.replace(",", ".")) : undefined;
      out.push({
        id: "adv_" + i,
        include: true,
        title,
        number: val("number") || undefined,
        semester: val("semester") || undefined,
        credits: credits != null && !Number.isNaN(credits) ? credits : undefined,
        instructor: val("instructor") || undefined,
        type: val("type") || undefined,
        description: val("description") || undefined,
        topics: [],
        confidence: 0.9,
        warnings: [],
        source: { sheetName, rowIndex: headerRow + i, originalCells: r },
      });
    });
    setPreview(out);
  };

  const doImport = () => {
    if (!preview?.length) { toast.error(t.syllabusNoRowsPicked); return; }
    let programId: string | undefined;
    let programNameFinal: string | undefined;
    if (destMode === "new") {
      if (!programName.trim()) { toast.error(t.programName); return; }
      const p = store.createProgram({
        name: programName.trim(),
        institution: institution.trim(),
        degree: "",
        years: 3,
        semesters: [],
      });
      programId = p.id;
      programNameFinal = p.name;
    } else {
      if (!existingProgramId) return;
      programId = existingProgramId;
      programNameFinal = data.programs.find((p) => p.id === existingProgramId)?.name;
    }
    const courseIds: string[] = [];
    preview.filter((p) => p.include).forEach((row, idx) => {
      const c = store.createCourse({
        programId,
        title: row.title,
        number: row.number,
        semester: row.semester,
        credits: row.credits,
        instructor: row.instructor,
        type: row.type,
        description: row.description,
        status: "not_started",
        order: idx,
      });
      courseIds.push(c.id);
    });
    store.recordSyllabusImport({
      source: "xlsx",
      fileName,
      sheetName,
      programId,
      programName: programNameFinal,
      courseIds,
      topicIds: [],
    });
    toast.success(`${t.syllabusImported}: ${courseIds.length}`);
    setPreview(null);
  };

  return (
    <div className="p-3 space-y-4 border-t border-border">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{t.syllabusChooseSheet}:</span>
          <Select value={sheetName} onValueChange={setSheetName}>
            <SelectTrigger className="h-8 w-[200px] bg-background"><SelectValue /></SelectTrigger>
            <SelectContent>
              {workbook.SheetNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{t.syllabusHeaderRow}:</span>
          <Input type="number" min={1} className="h-8 w-20" value={headerRow} onChange={(e) => setHeaderRow(Math.max(1, Number(e.target.value) || 1))} />
        </div>
      </div>
      <div>
        <h4 className="font-semibold text-sm mb-2">{t.syllabusRawSpreadsheet} · {rows.length} {t.syllabusRowCount}</h4>
        <div className="overflow-auto max-h-56 border border-border rounded">
          <table className="w-full text-xs">
            <tbody>
              {rows.slice(0, 12).map((r, ri) => (
                <tr key={ri} className={ri === headerRow - 1 ? "bg-primary/10 font-semibold" : ""}>
                  <td className="px-2 py-1 text-muted-foreground border-e border-border w-10">{ri + 1}</td>
                  {r.map((c, ci) => <td key={ci} className="px-2 py-1 border-e border-border align-top">{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div>
        <h4 className="font-semibold text-sm mb-2">{t.syllabusColumnMapping}</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {COURSE_FIELDS.map((f) => (
            <div key={f} className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">{f}</label>
              <Select
                value={mapping[f] == null ? "__none__" : String(mapping[f])}
                onValueChange={(v) => setMapping((m) => {
                  const next = { ...m };
                  if (v === "__none__") delete next[f]; else next[f] = Number(v);
                  return next;
                })}
              >
                <SelectTrigger className="h-9 bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t.syllabusColIgnore}</SelectItem>
                  {headers.map((h, i) => <SelectItem key={i} value={String(i)}>{h || `(col ${i + 1})`}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
        <Button onClick={build} variant="outline" className="mt-3">{t.syllabusCoursePreview}</Button>
      </div>
      {preview && (
        <div>
          <h4 className="font-semibold text-sm mb-2">{t.syllabusCoursePreview} · {preview.length}</h4>
          <div className="flex flex-wrap gap-2 mb-2">
            <Button size="sm" variant={destMode === "new" ? "default" : "outline"} onClick={() => setDestMode("new")}>{t.syllabusNewProgram}</Button>
            <Button size="sm" variant={destMode === "existing" ? "default" : "outline"} onClick={() => setDestMode("existing")} disabled={data.programs.length === 0}>{t.syllabusExistingProgram}</Button>
          </div>
          {destMode === "new" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input placeholder={t.programName} value={programName} onChange={(e) => setProgramName(e.target.value)} />
              <Input placeholder={t.institution} value={institution} onChange={(e) => setInstitution(e.target.value)} />
            </div>
          ) : (
            <Select value={existingProgramId} onValueChange={setExistingProgramId}>
              <SelectTrigger className="h-9 bg-background max-w-md"><SelectValue placeholder={t.programName} /></SelectTrigger>
              <SelectContent>
                {data.programs.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Button className="mt-3" onClick={doImport}>
            <CheckCircle2 className="h-4 w-4 me-1" />{t.syllabusRunImport}
          </Button>
        </div>
      )}
    </div>
  );
}

// =================================================================
// JSON importer (unchanged behaviour)
// =================================================================

interface ParsedJson {
  program?: { name?: string; institution?: string; degree?: string; years?: number; semesters?: string[] };
  courses?: Array<{
    title?: string;
    originalTitle?: string;
    number?: string;
    semester?: string;
    credits?: number;
    instructor?: string;
    type?: string;
    description?: string;
    topics?: string[];
  }>;
}

function JsonImporter() {
  const { t } = useApp();
  const data = useData();
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParsedJson | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [destMode, setDestMode] = useState<"new" | "existing">("new");
  const [newProgramName, setNewProgramName] = useState("");
  const [newInstitution, setNewInstitution] = useState("");
  const [existingProgramId, setExistingProgramId] = useState<string>("");

  const doParse = () => {
    setErr(null);
    try {
      const obj = JSON.parse(text) as ParsedJson;
      if (!obj || typeof obj !== "object") throw new Error("Not an object");
      const courses = Array.isArray(obj.courses) ? obj.courses : [];
      const cleanCourses = courses
        .filter((c) => c && typeof c.title === "string" && c.title.trim())
        .map((c) => ({
          ...c,
          topics: Array.isArray(c.topics) ? c.topics.map((s) => String(s).trim()).filter(Boolean) : [],
        }));
      setParsed({ program: obj.program, courses: cleanCourses });
      if (obj.program?.name && !newProgramName) setNewProgramName(obj.program.name);
      if (obj.program?.institution && !newInstitution) setNewInstitution(obj.program.institution);
    } catch (e) {
      setErr((e as Error).message);
      setParsed(null);
    }
  };

  const doImport = () => {
    if (!parsed?.courses?.length) { toast.error(t.syllabusNoRowsPicked); return; }
    let programId: string | undefined;
    let programName: string | undefined;
    if (destMode === "new") {
      if (!newProgramName.trim()) { toast.error(t.programName); return; }
      const p = store.createProgram({
        name: newProgramName.trim(),
        institution: newInstitution.trim(),
        degree: parsed.program?.degree ?? "",
        years: parsed.program?.years ?? 3,
        semesters: parsed.program?.semesters ?? [],
      });
      programId = p.id;
      programName = p.name;
    } else {
      if (!existingProgramId) { toast.error(t.programName); return; }
      programId = existingProgramId;
      programName = data.programs.find((p) => p.id === existingProgramId)?.name;
    }
    const createdCourses: Course[] = [];
    const createdTopics: Topic[] = [];
    parsed.courses.forEach((c, idx) => {
      const nc = store.createCourse({
        programId,
        title: c.title!.trim(),
        originalTitle: c.originalTitle,
        number: c.number,
        semester: c.semester,
        credits: c.credits,
        instructor: c.instructor,
        type: c.type,
        description: c.description,
        status: "not_started",
        order: idx,
      });
      createdCourses.push(nc);
      (c.topics ?? []).forEach((tt, ti) => {
        const topic = store.createTopic({ courseId: nc.id, title: tt, status: "not_started", order: ti });
        createdTopics.push(topic);
      });
    });
    store.recordSyllabusImport({
      source: "json",
      programId,
      programName,
      courseIds: createdCourses.map((c) => c.id),
      topicIds: createdTopics.map((tp) => tp.id),
    });
    toast.success(
      `${t.syllabusImported}: ${createdCourses.length} · ${createdTopics.length}`,
    );
    setText("");
    setParsed(null);
    setNewProgramName("");
    setNewInstitution("");
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-surface p-4 space-y-2">
        <p className="text-sm text-muted-foreground">{t.syllabusJsonPasteHelp}</p>
        <p className="text-xs text-muted-foreground font-mono break-all">{t.syllabusJsonSchemaHint}</p>
        <Textarea
          rows={10}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="font-mono text-xs"
          placeholder='{ "program": { "name": "..." }, "courses": [ { "title": "..." } ] }'
        />
        <div className="flex gap-2">
          <Button variant="outline" onClick={doParse} disabled={!text.trim()}>
            {t.syllabusJsonPreview}
          </Button>
        </div>
        {err && <p className="text-xs text-destructive">{err}</p>}
      </div>

      {parsed && (
        <div className="rounded-lg border border-border bg-surface p-4 space-y-4">
          <h3 className="font-semibold text-sm">
            {t.syllabusJsonPreview} · {parsed.courses?.length ?? 0} {t.syllabusRowCount}
          </h3>
          <div className="max-h-64 overflow-auto border border-border rounded">
            <table className="w-full text-xs">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-2 py-1 text-start">{t.title}</th>
                  <th className="px-2 py-1 text-start">{t.courseNumber}</th>
                  <th className="px-2 py-1 text-start">{t.semester}</th>
                  <th className="px-2 py-1 text-start">{t.credits}</th>
                  <th className="px-2 py-1 text-start">{t.topics}</th>
                </tr>
              </thead>
              <tbody>
                {(parsed.courses ?? []).map((c, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-2 py-1">{c.title}</td>
                    <td className="px-2 py-1">{c.number ?? ""}</td>
                    <td className="px-2 py-1">{c.semester ?? ""}</td>
                    <td className="px-2 py-1">{c.credits ?? ""}</td>
                    <td className="px-2 py-1 text-muted-foreground">{c.topics?.length ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 border-t border-border pt-4">
            <h4 className="font-semibold text-sm">{t.syllabusDestinationProgram}</h4>
            <div className="flex gap-2">
              <Button size="sm" variant={destMode === "new" ? "default" : "outline"} onClick={() => setDestMode("new")}>
                {t.syllabusNewProgram}
              </Button>
              <Button size="sm" variant={destMode === "existing" ? "default" : "outline"} onClick={() => setDestMode("existing")} disabled={data.programs.length === 0}>
                {t.syllabusExistingProgram}
              </Button>
            </div>
            {destMode === "new" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input placeholder={t.programName} value={newProgramName} onChange={(e) => setNewProgramName(e.target.value)} />
                <Input placeholder={t.institution} value={newInstitution} onChange={(e) => setNewInstitution(e.target.value)} />
              </div>
            ) : (
              <Select value={existingProgramId} onValueChange={setExistingProgramId}>
                <SelectTrigger className="h-9 bg-background max-w-md"><SelectValue placeholder={t.programName} /></SelectTrigger>
                <SelectContent>
                  {data.programs.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          <Button onClick={doImport}>
            <CheckCircle2 className="h-4 w-4 me-1" />
            {t.syllabusRunImport}
          </Button>
        </div>
      )}
    </div>
  );
}

// Exported for settings diagnostics
export { PARSER_VERSION };
