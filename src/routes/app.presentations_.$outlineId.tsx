import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/lib/app-context";
import { useData, store, type Slide } from "@/lib/store";
import { ArrowLeft, Plus, Trash2, Copy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/presentations_/$outlineId")({
  component: OutlineEditor,
});

function toMarkdown(title: string, slides: Slide[]): string {
  return [
    `# ${title}`,
    "",
    ...slides.flatMap((s) => [
      `## ${s.title}`,
      "",
      ...s.bullets.map((b) => `- ${b}`),
      s.speakerNotes ? `\n> ${s.speakerNotes}` : "",
      s.sourceQuote ? `\n_${s.sourceQuote}_` : "",
      "",
    ]),
  ].join("\n");
}

function OutlineEditor() {
  const { outlineId } = Route.useParams();
  const { t } = useApp();
  const data = useData();
  const navigate = useNavigate();
  const outline = data.presentationOutlines.find((p) => p.id === outlineId);

  if (!outline) {
    return (
      <div>
        <Button variant="ghost" onClick={() => navigate({ to: "/app/presentations" })}>
          <ArrowLeft className="h-4 w-4 me-1" />{t.back}
        </Button>
      </div>
    );
  }

  const copyMd = async () => {
    const md = toMarkdown(outline.title, outline.slides);
    try {
      await navigator.clipboard.writeText(md);
      toast.success(t.copied);
    } catch {
      toast.error("Clipboard error");
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/app/presentations" })} className="mb-3">
        <ArrowLeft className="h-4 w-4 me-1" />{t.back}
      </Button>
      <PageHeader
        title={
          <Input
            value={outline.title}
            onChange={(e) => store.updateOutline(outline.id, { title: e.target.value })}
            className="text-2xl md:text-3xl font-bold bg-transparent border-transparent hover:border-input p-0 h-auto"
          />
        }
        actions={
          <>
            <Button variant="outline" onClick={copyMd}><Copy className="h-4 w-4 me-1" />{t.exportMarkdown}</Button>
            <Button onClick={() => store.addSlide(outline.id)}><Plus className="h-4 w-4 me-1" />{t.addSlide}</Button>
          </>
        }
      />
      {outline.slides.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center text-muted-foreground">
          {t.empty}
        </div>
      )}
      <div className="space-y-3">
        {outline.slides.map((s, idx) => (
          <div key={s.id} className="rounded-lg border border-border bg-surface p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">{t.slide} {idx + 1}</div>
              <Button size="icon" variant="ghost" onClick={() => store.deleteSlide(outline.id, s.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div><Label>{t.title}</Label>
              <Input value={s.title} onChange={(e) => store.updateSlide(outline.id, s.id, { title: e.target.value })} />
            </div>
            <div><Label>{t.bullets}</Label>
              <textarea
                className="w-full min-h-[100px] rounded-md border border-input bg-background p-3 text-sm"
                value={s.bullets.join("\n")}
                onChange={(e) => store.updateSlide(outline.id, s.id, { bullets: e.target.value.split("\n") })}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label>{t.speakerNotes}</Label>
                <textarea
                  className="w-full min-h-[80px] rounded-md border border-input bg-background p-3 text-sm"
                  value={s.speakerNotes ?? ""}
                  onChange={(e) => store.updateSlide(outline.id, s.id, { speakerNotes: e.target.value })}
                />
              </div>
              <div><Label>{t.sourceQuote}</Label>
                <textarea
                  className="w-full min-h-[80px] rounded-md border border-input bg-background p-3 text-sm"
                  value={s.sourceQuote ?? ""}
                  onChange={(e) => store.updateSlide(outline.id, s.id, { sourceQuote: e.target.value })}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
