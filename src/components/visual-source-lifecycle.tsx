import { useEffect, useMemo } from "react";
import { useData } from "@/lib/store";
import { pruneVisualSourceData } from "@/lib/visual-source-store";

/**
 * Keeps IndexedDB visual records aligned with the canonical material list.
 * Deleting a material or resetting/importing localStorage eventually removes
 * orphaned image blobs and OCR drafts without coupling the synchronous store
 * to IndexedDB.
 */
export function VisualSourceLifecycle() {
  const data = useData();
  const materialIds = useMemo(
    () => data.materials.map((material) => material.id).sort(),
    [data.materials],
  );
  const materialKey = materialIds.join("|");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void pruneVisualSourceData(materialIds).catch((error) => {
        console.warn("Could not prune orphaned Lamdan visual data", error);
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [materialKey]);

  return null;
}
