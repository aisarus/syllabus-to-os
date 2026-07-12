import { createFileRoute } from "@tanstack/react-router";
import { MaterialWorkspace } from "@/components/material-workspace";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/app-context";
import { useData } from "@/lib/store";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/app/materials/$materialId")({
  component: MaterialDetail,
});

function MaterialDetail() {
  const { materialId } = Route.useParams();
  const { t } = useApp();
  const data = useData();
  const navigate = Route.useNavigate();
  const material = data.materials.find((item) => item.id === materialId);

  if (!material) {
    return (
      <div className="mx-auto max-w-6xl">
        <Button variant="ghost" onClick={() => navigate({ to: "/app/materials" })}>
          <ArrowLeft className="h-4 w-4 me-1" />
          {t.back}
        </Button>
        <p className="mt-4 text-muted-foreground">{t.empty}</p>
      </div>
    );
  }

  return <MaterialWorkspace material={material} />;
}
