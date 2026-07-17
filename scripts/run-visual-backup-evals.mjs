// Workspace backup v2 wraps and validates the legacy visual archive, so this
// stable legacy entrypoint deliberately executes the compatibility evaluator.
await import("./run-workspace-backup-evals.mjs");
