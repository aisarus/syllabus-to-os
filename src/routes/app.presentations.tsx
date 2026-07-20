import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp } from "@/lib/app-context";
import { useData, store } from "@/lib/store";
import { Plus, Trash2 } from "lucide-react";
import { AIGenerateButton } from "@/components/ai-generate-dialog";
import { useState } from "react";

export const Route = createFileRoute("/app/presentations")({
  component: PresentationsPage,
});

function PresentationsPage() {
  const { t, lang } = useApp();
  const data = useData();
  const [title, setTitle] = useState("");
  const isRu = lang === "ru";

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader title={t.presentations} actions={<AIGenerateButton kind="presentation" />} />
      <div className="flex gap-2 mb-4">
        <Input
          dir="auto"
          aria-label={t.title}
          placeholder={t.title}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Button
          onClick={() => {
            store.createOutline({ title: title || "Untitled outline" });
            setTitle("");
          }}
        >
          <Plus className="h-4 w-4 me-1" />
          {t.createOutline}
        </Button>
      </div>
      {data.presentationOutlines.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center text-muted-foreground">
          {t.presentationsEmpty}
        </div>
      ) : (
        <div className="space-y-2">
          {data.presentationOutlines.map((o) => {
            const course = data.courses.find((c) => c.id === o.courseId);
            return (
              <div
                key={o.id}
                className="rounded-lg border border-border bg-surface p-3 flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <Link
                    to="/app/presentations/$outlineId"
                    params={{ outlineId: o.id }}
                    className="font-medium hover:underline"
                  >
                    {o.title}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {o.slides.length} {t.slides}
                    {course && ` · ${course.title}`}
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={
                    isRu ? `Удалить презентацию «${o.title}»` : `Delete presentation “${o.title}”`
                  }
                  onClick={() => {
                    if (confirm(t.confirm + "?")) store.deleteOutline(o.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
