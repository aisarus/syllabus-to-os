import { useEffect, useMemo, useRef } from "react";
import { deleteLongMediaData, listLongMediaManifests } from "@/lib/long-media-store";
import { getDataSnapshot, useData } from "@/lib/store";

const ORPHAN_CONFIRMATION_MS = 15_000;

export function LongMediaLifecycle() {
  const data = useData();
  const orphanSinceRef = useRef(new Map<string, number>());
  const materialRevision = useMemo(
    () => data.materials.map((item) => item.id).sort().join("|"),
    [data.materials],
  );

  useEffect(() => {
    let cancelled = false;

    const inspectOrphans = async () => {
      const validMaterialIds = new Set(getDataSnapshot().materials.map((item) => item.id));
      const manifests = await listLongMediaManifests();
      const now = Date.now();
      const visibleManifestIds = new Set(manifests.map((manifest) => manifest.materialId));

      for (const materialId of orphanSinceRef.current.keys()) {
        if (validMaterialIds.has(materialId) || !visibleManifestIds.has(materialId)) {
          orphanSinceRef.current.delete(materialId);
        }
      }

      for (const manifest of manifests) {
        if (cancelled) return;
        if (validMaterialIds.has(manifest.materialId)) {
          orphanSinceRef.current.delete(manifest.materialId);
          continue;
        }
        const firstSeenAt = orphanSinceRef.current.get(manifest.materialId);
        if (!firstSeenAt) {
          orphanSinceRef.current.set(manifest.materialId, now);
          continue;
        }
        if (now - firstSeenAt < ORPHAN_CONFIRMATION_MS) continue;
        await deleteLongMediaData(manifest.materialId);
        orphanSinceRef.current.delete(manifest.materialId);
      }
    };

    const startTimer = window.setTimeout(() => {
      void inspectOrphans().catch((error) => {
        console.warn("Could not inspect orphaned Lamdan lecture media", error);
      });
    }, 1_000);
    const interval = window.setInterval(() => {
      void inspectOrphans().catch((error) => {
        console.warn("Could not inspect orphaned Lamdan lecture media", error);
      });
    }, 5_000);

    return () => {
      cancelled = true;
      window.clearTimeout(startTimer);
      window.clearInterval(interval);
    };
  }, [materialRevision]);

  return null;
}
