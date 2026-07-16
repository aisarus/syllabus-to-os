import { useEffect, useMemo, useRef } from "react";
import {
  deleteAutomaticTranscriptionJob,
  listAutomaticTranscriptionJobs,
} from "@/lib/automatic-transcription-store";
import { deleteLongMediaData, listLongMediaManifests } from "@/lib/long-media-store";
import {
  deleteResumableTranscriptionJob,
  listResumableTranscriptionJobs,
} from "@/lib/resumable-transcription-store";
import { getDataSnapshot, useData } from "@/lib/store";

const ORPHAN_CONFIRMATION_MS = 15_000;

export function LongMediaLifecycle() {
  const data = useData();
  const orphanSinceRef = useRef(new Map<string, number>());
  const materialRevision = useMemo(
    () =>
      data.materials
        .map((item) => item.id)
        .sort()
        .join("|"),
    [data.materials],
  );

  useEffect(() => {
    let cancelled = false;

    const inspectOrphans = async () => {
      const validMaterialIds = new Set(getDataSnapshot().materials.map((item) => item.id));
      const [manifests, jobs, rangeJobs] = await Promise.all([
        listLongMediaManifests(),
        listAutomaticTranscriptionJobs(),
        listResumableTranscriptionJobs(),
      ]);
      const now = Date.now();
      const manifestIds = new Set(manifests.map((manifest) => manifest.materialId));
      const jobIds = new Set(jobs.map((job) => job.materialId));
      const rangeJobIds = new Set(rangeJobs.map((job) => job.materialId));
      const visibleLocalIds = new Set([...manifestIds, ...jobIds, ...rangeJobIds]);

      for (const materialId of orphanSinceRef.current.keys()) {
        if (validMaterialIds.has(materialId) || !visibleLocalIds.has(materialId)) {
          orphanSinceRef.current.delete(materialId);
        }
      }

      for (const materialId of visibleLocalIds) {
        if (cancelled) return;
        if (validMaterialIds.has(materialId)) {
          orphanSinceRef.current.delete(materialId);
          continue;
        }
        const firstSeenAt = orphanSinceRef.current.get(materialId);
        if (!firstSeenAt) {
          orphanSinceRef.current.set(materialId, now);
          continue;
        }
        if (now - firstSeenAt < ORPHAN_CONFIRMATION_MS) continue;
        if (manifestIds.has(materialId)) await deleteLongMediaData(materialId);
        if (jobIds.has(materialId)) await deleteAutomaticTranscriptionJob(materialId);
        if (rangeJobIds.has(materialId)) await deleteResumableTranscriptionJob(materialId);
        orphanSinceRef.current.delete(materialId);
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
