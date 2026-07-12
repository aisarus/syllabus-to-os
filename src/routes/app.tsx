import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { MaterialIntakeQueueProvider } from "@/components/material-intake-queue";
import { MaterialIntakeRouteLauncher } from "@/components/material-intake-route-launcher";
import { VisualSourceLifecycle } from "@/components/visual-source-lifecycle";

export const Route = createFileRoute("/app")({
  component: () => (
    <MaterialIntakeQueueProvider>
      <VisualSourceLifecycle />
      <AppShell>
        <MaterialIntakeRouteLauncher />
        <Outlet />
      </AppShell>
    </MaterialIntakeQueueProvider>
  ),
});
