import { useEffect, useMemo } from "react";
import { getAllVisualSourceIds } from "@/lib/multi-page-image-materials";
import { useData } from "@/lib/store";
import { pruneVisualSourceData } from "@/lib/visual-source-store";

/**
 * Keeps IndexedDB visual records aligned with the canonical material list.
 * Multi-page materials contribute both their parent material id and every
 * page-level visual id, so valid page images, OCR drafts and recipes survive.
 */
export function VisualSourceLifecycle() {
  const data = useData();
  const visualSourceIds = useMemo(() => getAllVisualSourceIds(data).sort(), [data.materials]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void pruneVisualSourceData(visualSourceIds).catch((error) => {
        console.warn("Could not prune orphaned Lamdan visual data", error);
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [visualSourceIds]);

  return null;
}
