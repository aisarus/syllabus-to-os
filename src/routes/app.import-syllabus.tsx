import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { FileUp, FileJson, Trash2, CheckCircle2 } from "lucide-react";
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

export const Route = createFileRoute("/app/import-syllabus")({
  component: ImportSyllabusPage,
});

type CourseField =
  | "title"
  | "originalTitle"
  | "number"
  | "semester"
  | "credits"
  | "instructor"
  | "type"
  | "description"
  | "topics";

const COURSE_FIELDS: CourseField[] = [
  "title",
  "originalTitle",
  "number",
  "semester",
  "credits",
  "instructor",
  "type",
  "description",
  "topics",
];

type Mapping = Partial<Record<CourseField, number>>; // column index

interface PreviewCourse {
  include: boolean;
  title: string;
  originalTitle?: string;
  number?: string;
  semester?: string;
  credits?: number;
  instructor?: string;
  type?: string;
  description?: string;
  topics: string[];
}

function splitTopics(v: string): string[] {
  return v
    .split(/[\n;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function ImportSyllabusPage() {
  const { t } = useApp();
  const data = useData();

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader title={t.importSyllabus} subtitle={t.importSyllabusIntro} />
      <Tabs defaultValue="xlsx" className="w-full">
        <TabsList>
          <TabsTrigger value="xlsx">
            <FileUp className="h-4 w-4 me-1" />
            {t.syllabusTabXlsx}
          </TabsTrigger>
          <TabsTrigger value="json">
            <FileJson className="h-4 w-4 me-1" />
            {t.syllabusTabJson}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="xlsx" className="mt-4">
          <XlsxImporter />
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
                  {s.courseIds.length} {t.syllabusCoursesImported.split(" ")[0]} ·{" "}
                  {s.topicIds.length} {t.syllabusTopicsImported.split(" ")[0]}
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

// ============ XLSX ============

function XlsxImporter() {
  const { t } = useApp();
  const data = useData();
  const fileRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string>("");
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetName, setSheetName] = useState<string>("");
  const [headerRow, setHeaderRow] = useState<number>(1); // 1-indexed
  const [mapping, setMapping] = useState<Mapping>({});
  const [preview, setPreview] = useState<PreviewCourse[] | null>(null);
  const [destMode, setDestMode] = useState<"new" | "existing">("new");
  const [newProgramName, setNewProgramName] = useState("");
  const [newInstitution, setNewInstitution] = useState("");
  const [existingProgramId, setExistingProgramId] = useState<string>("");

  const rows: string[][] = useMemo(() => {
    if (!workbook || !sheetName) return [];
    const sh = workbook.Sheets[sheetName];
    if (!sh) return [];
    const raw = XLSX.utils.sheet_to_json<unknown[]>(sh, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false,
    });
    return raw.map((r) => r.map((c) => (c == null ? "" : String(c))));
  }, [workbook, sheetName]);

  const headers: string[] = useMemo(() => {
    const idx = headerRow - 1;
    if (idx < 0 || idx >= rows.length) return [];
    return rows[idx] ?? [];
  }, [rows, headerRow]);

  const bodyRows = useMemo(() => rows.slice(headerRow), [rows, headerRow]);

  const onFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      setWorkbook(wb);
      setFileName(file.name);
      const first = wb.SheetNames[0] ?? "";
      setSheetName(first);
      setHeaderRow(1);
      setMapping({});
      setPreview(null);
    } catch (e) {
      toast.error((e as Error).message || "Failed to read file");
    }
  };

  const buildPreview = () => {
    if (mapping.title == null) {
      toast.error(t.syllabusTitleRequired);
      return;
    }
    const out: PreviewCourse[] = [];
    for (const row of bodyRows) {
      const val = (f: CourseField) => {
        const i = mapping[f];
        if (i == null) return "";
        return (row[i] ?? "").trim();
      };
      const title = val("title");
      if (!title) continue;
      const creditsStr = val("credits");
      const credits = creditsStr ? Number(creditsStr.replace(",", ".")) : undefined;
      out.push({
        include: true,
        title,
        originalTitle: val("originalTitle") || undefined,
        number: val("number") || undefined,
        semester: val("semester") || undefined,
        credits: credits != null && !Number.isNaN(credits) ? credits : undefined,
        instructor: val("instructor") || undefined,
        type: val("type") || undefined,
        description: val("description") || undefined,
        topics: splitTopics(val("topics")),
      });
    }
    setPreview(out);
    if (out.length === 0) toast.error(t.syllabusNoRowsPicked);
  };

  const doImport = () => {
    if (!preview) return;
    const picked = preview.filter((p) => p.include);
    if (picked.length === 0) {
      toast.error(t.syllabusNoRowsPicked);
      return;
    }
    let programId: string | undefined;
    let programName: string | undefined;
    if (destMode === "new") {
      if (!newProgramName.trim()) {
        toast.error(t.programName);
        return;
      }
      const p = store.createProgram({
        name: newProgramName.trim(),
        institution: newInstitution.trim(),
        degree: "",
        years: 3,
        semesters: [],
      });
      programId = p.id;
      programName = p.name;
    } else {
      if (!existingProgramId) {
        toast.error(t.programName);
        return;
      }
      programId = existingProgramId;
      programName = data.programs.find((p) => p.id === existingProgramId)?.name;
    }

    const createdCourses: Course[] = [];
    const createdTopics: Topic[] = [];
    picked.forEach((row, idx) => {
      const c = store.createCourse({
        programId,
        title: row.title,
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
      sheetName,
      programId,
      programName,
      courseIds: createdCourses.map((c) => c.id),
      topicIds: createdTopics.map((t) => t.id),
    });

    toast.success(
      `${t.syllabusImported}: ${createdCourses.length} ${t.syllabusCoursesImported.split(" ")[0]}, ${createdTopics.length} ${t.syllabusTopicsImported.split(" ")[0]}`,
    );

    // reset transient
    setPreview(null);
    setNewProgramName("");
    setNewInstitution("");
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-surface p-4">
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => fileRef.current?.click()}>
            <FileUp className="h-4 w-4 me-1" />
            {t.syllabusChooseXlsx}
          </Button>
          {fileName && (
            <span className="text-sm text-muted-foreground">{fileName}</span>
          )}
          {workbook && (
            <>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">{t.syllabusChooseSheet}:</span>
                <Select value={sheetName} onValueChange={setSheetName}>
                  <SelectTrigger className="h-8 w-[200px] bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {workbook.SheetNames.map((n) => (
                      <SelectItem key={n} value={n}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">{t.syllabusHeaderRow}:</span>
                <Input
                  type="number"
                  min={1}
                  className="h-8 w-20"
                  value={headerRow}
                  onChange={(e) =>
                    setHeaderRow(Math.max(1, Number(e.target.value) || 1))
                  }
                />
              </div>
            </>
          )}
        </div>
      </div>

      {rows.length > 0 && (
        <div className="rounded-lg border border-border bg-surface p-4">
          <h3 className="font-semibold text-sm mb-2">
            {t.syllabusSheetPreview} · {rows.length} {t.syllabusRowCount}
          </h3>
          <div className="overflow-auto max-h-64 border border-border rounded">
            <table className="w-full text-xs">
              <tbody>
                {rows.slice(0, 12).map((r, ri) => (
                  <tr
                    key={ri}
                    className={ri === headerRow - 1 ? "bg-primary/10 font-semibold" : ""}
                  >
                    <td className="px-2 py-1 text-muted-foreground border-e border-border w-10">
                      {ri + 1}
                    </td>
                    {r.map((c, ci) => (
                      <td key={ci} className="px-2 py-1 border-e border-border align-top">
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {headers.length > 0 && (
        <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
          <div>
            <h3 className="font-semibold text-sm">{t.syllabusColumnMapping}</h3>
            <p className="text-xs text-muted-foreground">{t.syllabusMappingHelp}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {COURSE_FIELDS.map((field) => (
              <div key={field} className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">
                  {labelFor(t, field)}
                </label>
                <Select
                  value={mapping[field] == null ? "__none__" : String(mapping[field])}
                  onValueChange={(v) =>
                    setMapping((m) => {
                      const next = { ...m };
                      if (v === "__none__") delete next[field];
                      else next[field] = Number(v);
                      return next;
                    })
                  }
                >
                  <SelectTrigger className="h-9 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t.syllabusColIgnore}</SelectItem>
                    {headers.map((h, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {h || `(col ${i + 1})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{t.syllabusTopicsSplitHelp}</p>
          <Button onClick={buildPreview} variant="outline">
            {t.syllabusCoursePreview}
          </Button>
        </div>
      )}

      {preview && preview.length > 0 && (
        <div className="rounded-lg border border-border bg-surface p-4 space-y-4">
          <h3 className="font-semibold text-sm">
            {t.syllabusCoursePreview} · {preview.filter((p) => p.include).length}/
            {preview.length}
          </h3>
          <div className="overflow-auto max-h-96 border border-border rounded">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 sticky top-0">
                <tr>
                  <th className="px-2 py-1 text-start">{t.syllabusIncludeRow}</th>
                  <th className="px-2 py-1 text-start">{t.title}</th>
                  <th className="px-2 py-1 text-start">{t.courseNumber}</th>
                  <th className="px-2 py-1 text-start">{t.semester}</th>
                  <th className="px-2 py-1 text-start">{t.credits}</th>
                  <th className="px-2 py-1 text-start">{t.instructor}</th>
                  <th className="px-2 py-1 text-start">{t.topics}</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((p, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-2 py-1 align-top">
                      <Checkbox
                        checked={p.include}
                        onCheckedChange={(v) =>
                          setPreview((prev) =>
                            prev
                              ? prev.map((r, j) =>
                                  j === i ? { ...r, include: Boolean(v) } : r,
                                )
                              : prev,
                          )
                        }
                      />
                    </td>
                    <td className="px-2 py-1 align-top">
                      <Input
                        className="h-7 text-xs"
                        value={p.title}
                        onChange={(e) =>
                          updateRow(setPreview, i, { title: e.target.value })
                        }
                      />
                    </td>
                    <td className="px-2 py-1 align-top">
                      <Input
                        className="h-7 text-xs w-24"
                        value={p.number ?? ""}
                        onChange={(e) =>
                          updateRow(setPreview, i, { number: e.target.value })
                        }
                      />
                    </td>
                    <td className="px-2 py-1 align-top">
                      <Input
                        className="h-7 text-xs w-32"
                        value={p.semester ?? ""}
                        onChange={(e) =>
                          updateRow(setPreview, i, { semester: e.target.value })
                        }
                      />
                    </td>
                    <td className="px-2 py-1 align-top">
                      <Input
                        className="h-7 text-xs w-16"
                        value={p.credits ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          const n = v === "" ? undefined : Number(v);
                          updateRow(setPreview, i, {
                            credits: n != null && !Number.isNaN(n) ? n : undefined,
                          });
                        }}
                      />
                    </td>
                    <td className="px-2 py-1 align-top">
                      <Input
                        className="h-7 text-xs"
                        value={p.instructor ?? ""}
                        onChange={(e) =>
                          updateRow(setPreview, i, { instructor: e.target.value })
                        }
                      />
                    </td>
                    <td className="px-2 py-1 align-top text-muted-foreground">
                      {p.topics.length}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ProgramDestination
            destMode={destMode}
            setDestMode={setDestMode}
            newProgramName={newProgramName}
            setNewProgramName={setNewProgramName}
            newInstitution={newInstitution}
            setNewInstitution={setNewInstitution}
            existingProgramId={existingProgramId}
            setExistingProgramId={setExistingProgramId}
          />

          <Button onClick={doImport}>
            <CheckCircle2 className="h-4 w-4 me-1" />
            {t.syllabusRunImport}
          </Button>
        </div>
      )}
    </div>
  );
}

function updateRow(
  setPreview: React.Dispatch<React.SetStateAction<PreviewCourse[] | null>>,
  i: number,
  patch: Partial<PreviewCourse>,
) {
  setPreview((prev) =>
    prev ? prev.map((r, j) => (j === i ? { ...r, ...patch } : r)) : prev,
  );
}

function labelFor(t: ReturnType<typeof useApp>["t"], field: CourseField): string {
  switch (field) {
    case "title":
      return t.syllabusColTitle;
    case "originalTitle":
      return t.syllabusColOriginalTitle;
    case "number":
      return t.syllabusColNumber;
    case "semester":
      return t.syllabusColSemester;
    case "credits":
      return t.syllabusColCredits;
    case "instructor":
      return t.syllabusColInstructor;
    case "type":
      return t.syllabusColType;
    case "description":
      return t.syllabusColDescription;
    case "topics":
      return t.syllabusColTopics;
  }
}

function ProgramDestination(props: {
  destMode: "new" | "existing";
  setDestMode: (m: "new" | "existing") => void;
  newProgramName: string;
  setNewProgramName: (v: string) => void;
  newInstitution: string;
  setNewInstitution: (v: string) => void;
  existingProgramId: string;
  setExistingProgramId: (v: string) => void;
}) {
  const { t } = useApp();
  const data = useData();
  return (
    <div className="space-y-3 border-t border-border pt-4">
      <h4 className="font-semibold text-sm">{t.syllabusDestinationProgram}</h4>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={props.destMode === "new" ? "default" : "outline"}
          onClick={() => props.setDestMode("new")}
        >
          {t.syllabusNewProgram}
        </Button>
        <Button
          size="sm"
          variant={props.destMode === "existing" ? "default" : "outline"}
          onClick={() => props.setDestMode("existing")}
          disabled={data.programs.length === 0}
        >
          {t.syllabusExistingProgram}
        </Button>
      </div>
      {props.destMode === "new" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            placeholder={t.programName}
            value={props.newProgramName}
            onChange={(e) => props.setNewProgramName(e.target.value)}
          />
          <Input
            placeholder={t.institution}
            value={props.newInstitution}
            onChange={(e) => props.setNewInstitution(e.target.value)}
          />
        </div>
      ) : (
        <Select value={props.existingProgramId} onValueChange={props.setExistingProgramId}>
          <SelectTrigger className="h-9 bg-background max-w-md">
            <SelectValue placeholder={t.programName} />
          </SelectTrigger>
          <SelectContent>
            {data.programs.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

// ============ JSON ============

interface ParsedJson {
  program?: {
    name?: string;
    institution?: string;
    degree?: string;
    years?: number;
    semesters?: string[];
  };
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
          topics: Array.isArray(c.topics)
            ? c.topics.map((s) => String(s).trim()).filter(Boolean)
            : [],
        }));
      setParsed({ program: obj.program, courses: cleanCourses });
      if (obj.program?.name && !newProgramName) setNewProgramName(obj.program.name);
      if (obj.program?.institution && !newInstitution)
        setNewInstitution(obj.program.institution);
    } catch (e) {
      setErr((e as Error).message);
      setParsed(null);
    }
  };

  const doImport = () => {
    if (!parsed?.courses?.length) {
      toast.error(t.syllabusNoRowsPicked);
      return;
    }
    let programId: string | undefined;
    let programName: string | undefined;
    if (destMode === "new") {
      if (!newProgramName.trim()) {
        toast.error(t.programName);
        return;
      }
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
      if (!existingProgramId) {
        toast.error(t.programName);
        return;
      }
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
        const topic = store.createTopic({
          courseId: nc.id,
          title: tt,
          status: "not_started",
          order: ti,
        });
        createdTopics.push(topic);
      });
    });

    store.recordSyllabusImport({
      source: "json",
      programId,
      programName,
      courseIds: createdCourses.map((c) => c.id),
      topicIds: createdTopics.map((t) => t.id),
    });

    toast.success(
      `${t.syllabusImported}: ${createdCourses.length} ${t.syllabusCoursesImported.split(" ")[0]}, ${createdTopics.length} ${t.syllabusTopicsImported.split(" ")[0]}`,
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
        <p className="text-xs text-muted-foreground font-mono break-all">
          {t.syllabusJsonSchemaHint}
        </p>
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
                    <td className="px-2 py-1 text-muted-foreground">
                      {c.topics?.length ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ProgramDestination
            destMode={destMode}
            setDestMode={setDestMode}
            newProgramName={newProgramName}
            setNewProgramName={setNewProgramName}
            newInstitution={newInstitution}
            setNewInstitution={setNewInstitution}
            existingProgramId={existingProgramId}
            setExistingProgramId={setExistingProgramId}
          />

          <Button onClick={doImport}>
            <CheckCircle2 className="h-4 w-4 me-1" />
            {t.syllabusRunImport}
          </Button>
        </div>
      )}
    </div>
  );
}
