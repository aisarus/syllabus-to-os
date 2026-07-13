import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/lib/app-context";
import { useData, store } from "@/lib/store";
import { Trash2, Plus } from "lucide-react";

export const Route = createFileRoute("/app/program")({
  component: ProgramPage,
});

function ProgramPage() {
  const { t } = useApp();
  const data = useData();
  const program = data.programs[0];
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    institution: "",
    degree: "",
    years: 3,
    semesters: "Sem A 2025/26, Sem B 2025/26",
  });

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader title={t.program} />
      {!program && !creating && (
        <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center">
          <p className="text-muted-foreground mb-4">{t.noProgram}</p>
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 me-1" />
            {t.createProgram}
          </Button>
        </div>
      )}
      {(creating || program) && (
        <div className="rounded-lg border border-border bg-surface p-6 space-y-4">
          <div>
            <Label>{t.programName}</Label>
            <Input
              value={program?.name ?? form.name}
              onChange={(e) =>
                program
                  ? store.updateProgram(program.id, { name: e.target.value })
                  : setForm({ ...form, name: e.target.value })
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t.institution}</Label>
              <Input
                value={program?.institution ?? form.institution}
                onChange={(e) =>
                  program
                    ? store.updateProgram(program.id, { institution: e.target.value })
                    : setForm({ ...form, institution: e.target.value })
                }
              />
            </div>
            <div>
              <Label>{t.degree}</Label>
              <Input
                value={program?.degree ?? form.degree}
                onChange={(e) =>
                  program
                    ? store.updateProgram(program.id, { degree: e.target.value })
                    : setForm({ ...form, degree: e.target.value })
                }
              />
            </div>
            <div>
              <Label>{t.years}</Label>
              <Input
                type="number"
                value={program?.years ?? form.years}
                onChange={(e) => {
                  const n = Number(e.target.value) || 0;
                  if (program) {
                    store.updateProgram(program.id, { years: n });
                  } else {
                    setForm({ ...form, years: n });
                  }
                }}
              />
            </div>
            <div>
              <Label>{t.semesters}</Label>
              <Input
                value={program ? program.semesters.join(", ") : form.semesters}
                onChange={(e) => {
                  const sems = e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean);
                  if (program) {
                    store.updateProgram(program.id, { semesters: sems });
                  } else {
                    setForm({ ...form, semesters: e.target.value });
                  }
                }}
              />
            </div>
          </div>
          <div className="flex gap-2">
            {!program && (
              <>
                <Button
                  onClick={() => {
                    store.createProgram({
                      name: form.name || "My Program",
                      institution: form.institution,
                      degree: form.degree,
                      years: form.years,
                      semesters: form.semesters
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    });
                    setCreating(false);
                  }}
                >
                  {t.save}
                </Button>
                <Button variant="ghost" onClick={() => setCreating(false)}>
                  {t.cancel}
                </Button>
              </>
            )}
            {program && (
              <Button
                variant="destructive"
                onClick={() => {
                  if (confirm(t.confirm + "?")) store.deleteProgram(program.id);
                }}
              >
                <Trash2 className="h-4 w-4 me-1" />
                {t.delete}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
