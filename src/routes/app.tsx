import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { MaterialIntakeQueueProvider } from "@/components/material-intake-queue";
import { MaterialIntakeRouteLauncher } from "@/components/material-intake-route-launcher";

export const Route = createFileRoute("/app")({
  component: () => (
    <MaterialIntakeQueueProvider>
      <AppShell>
        <MaterialIntakeRouteLauncher />
        <Outlet />
      </AppShell>
    </MaterialIntakeQueueProvider>
  ),
});
