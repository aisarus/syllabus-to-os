import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { MaterialIntakeQueueProvider } from "@/components/material-intake-queue";

export const Route = createFileRoute("/app")({
  component: () => (
    <MaterialIntakeQueueProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </MaterialIntakeQueueProvider>
  ),
});
