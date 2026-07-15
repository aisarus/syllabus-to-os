import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ConceptEvidenceLifecycle } from "@/components/concept-evidence-lifecycle";
import { LongMediaDataBoundary } from "@/components/long-media-data-boundary";
import { LongMediaLifecycle } from "@/components/long-media-lifecycle";
import { MaterialIntakeQueueProvider } from "@/components/material-intake-queue";
import { MaterialIntakeRouteLauncher } from "@/components/material-intake-route-launcher";
import { StoreSafetyLifecycle } from "@/components/store-safety-lifecycle";
import { VisualSourceLifecycle } from "@/components/visual-source-lifecycle";

export const Route = createFileRoute("/app")({
  component: () => (
    <MaterialIntakeQueueProvider>
      <VisualSourceLifecycle />
      <LongMediaLifecycle />
      <AppShell>
        <StoreSafetyLifecycle />
        <ConceptEvidenceLifecycle />
        <LongMediaDataBoundary />
        <MaterialIntakeRouteLauncher />
        <Outlet />
      </AppShell>
    </MaterialIntakeQueueProvider>
  ),
});
