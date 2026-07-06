import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Upload as UploadIcon, FileText, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/upload")({
  head: () => ({ meta: [{ title: "העלאת סילבוס · Lamdan AI" }] }),
  component: Upload,
});

function Upload() {
  const nav = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);

  return (
    <div dir="rtl" className="min-h-screen bg-background gradient-hero">
      <header className="mx-auto max-w-5xl px-4 py-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">ל</span>
          </div>
          <span className="font-bold">Lamdan AI</span>
        </Link>
        <Link to="/app/dashboard"><Button variant="ghost" size="sm">דגמה ללא העלאה →</Button></Link>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs text-muted-foreground mb-4">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> ניתוח AI לסילבוס
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">העלה קובץ קורס או ידיעון</h1>
          <p className="mt-3 text-muted-foreground">PDF · DOCX · XLSX · CSV · TXT · עד 25MB</p>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault(); setDrag(false);
            const f = e.dataTransfer.files?.[0];
            if (f) setFile(f);
          }}
          className={`glass-panel rounded-2xl border-2 border-dashed p-10 text-center transition ${drag ? "border-primary bg-primary/5" : "border-border"}`}
        >
          <div className="mx-auto h-14 w-14 rounded-2xl gradient-primary flex items-center justify-center shadow-glow mb-4">
            <UploadIcon className="h-6 w-6 text-primary-foreground" />
          </div>
          {file ? (
            <div>
              <div className="inline-flex items-center gap-2 rounded-lg bg-surface px-4 py-2">
                <FileText className="h-4 w-4 text-primary" />
                <span className="font-medium">{file.name}</span>
                <span className="text-xs text-muted-foreground">({Math.round(file.size / 1024)} KB)</span>
              </div>
              <div className="mt-3">
                <button onClick={() => setFile(null)} className="text-xs text-muted-foreground hover:text-foreground">החלף קובץ</button>
              </div>
            </div>
          ) : (
            <>
              <p className="font-medium">גררו קובץ לכאן או</p>
              <label className="mt-3 inline-flex">
                <input type="file" className="hidden" accept=".pdf,.docx,.xlsx,.csv,.txt" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                <span className="cursor-pointer inline-flex items-center gap-2 rounded-md gradient-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-glow">בחרו קובץ</span>
              </label>
              <p className="mt-4 text-xs text-muted-foreground">אין קובץ? נשתמש בסילבוס לדוגמה של בר-אילן · לימודי מידע</p>
            </>
          )}
        </div>

        <div className="mt-8 grid md:grid-cols-2 gap-4">
          <Field label="שם המוסד" defaultValue="אוניברסיטת בר-אילן" />
          <Field label="תוכנית לימודים" defaultValue="לימודי מידע" />
          <Field label="פקולטה / מחלקה" defaultValue="מדעי החברה" />
          <SelectField label="סוג תואר" options={["מכינה", "תואר ראשון", "תואר שני", "קורס בודד"]} def="תואר ראשון" />
          <SelectField label="שפת לימוד" options={["עברית", "אנגלית", "רוסית", "ערבית"]} def="עברית" />
          <SelectField label="שפת ההסבר שלי" options={["עברית", "אנגלית", "רוסית", "ערבית"]} def="עברית" />
        </div>

        <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            הנתונים שלך מוצפנים ולעולם לא ישותפו. ניתן למחוק בכל עת מההגדרות.
          </div>
          <Button size="lg" className="gradient-primary shadow-glow" onClick={() => nav({ to: "/parsing" })}>
            נתח סילבוס <ArrowRight className="ms-2 h-4 w-4 rtl:rotate-180" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, defaultValue }: { label: string; defaultValue?: string }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input className="mt-1.5 bg-surface border-border" defaultValue={defaultValue} />
    </div>
  );
}
function SelectField({ label, options, def }: { label: string; options: string[]; def: string }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Select defaultValue={def}>
        <SelectTrigger className="mt-1.5 bg-surface border-border"><SelectValue /></SelectTrigger>
        <SelectContent>{options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}
