import { useEffect, useMemo } from "react";
import { pruneLongMediaData } from "@/lib/long-media-store";
import { getDataSnapshot, useData } from "@/lib/store";

export function LongMediaLifecycle() {
  const data = useData();
  const materialRevision = useMemo(
    () => data.materials.map((item) => item.id).sort().join("|"),
    [data.materials],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const latestMaterialIds = getDataSnapshot().materials.map((item) => item.id);
      void pruneLongMediaData(latestMaterialIds).catch((error) => {
        console.warn("Could not prune orphaned Lamdan lecture media", error);
      });
    }, 750);
    return () => window.clearTimeout(timer);
  }, [materialRevision]);

  return null;
}
