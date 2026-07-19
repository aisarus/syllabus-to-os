/**
 * Kept temporarily for compatibility with old imports. Safety now lives in the
 * base store and the explicit WorkspaceRepository; no methods are mutated at
 * module-evaluation time.
 */
export function installStoreSafetyGuards(): void {
  // Intentionally empty. Remove callers during the repository migration.
}
