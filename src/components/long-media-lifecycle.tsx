import { useEffect, useMemo } from "react";
import { pruneLongMediaData } from "@/lib/long-media-store";
import { useData } from "@/lib/store";

export function LongMediaLifecycle() {
  const data = useData();
  const materialIds = useMemo(() => data.materials.map((item) => item.id).sort(), [data.materials]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void pruneLongMediaData(materialIds).catch((error) => {
        console.warn("Could not prune orphaned Lamdan lecture media", error);
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [materialIds]);

  return null;
}
