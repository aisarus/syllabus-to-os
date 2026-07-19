/**
 * Compatibility shim retained for older imports. Store safety is now installed
 * structurally through WorkspaceRepository and the base store mutators.
 */
export function installStoreSafetyGuards(): void {
  // Intentionally empty: no shared store method is mutated at import time.
}
