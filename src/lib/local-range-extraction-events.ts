export const LOCAL_RANGE_CLIP_READY_EVENT = "lamdan:local-range-clip-ready";

export interface LocalRangeClipReadyDetail {
  materialId: string;
  rangeId: string;
  file: File;
  persisted: boolean;
}

export function dispatchLocalRangeClipReady(detail: LocalRangeClipReadyDetail): void {
  window.dispatchEvent(
    new CustomEvent<LocalRangeClipReadyDetail>(LOCAL_RANGE_CLIP_READY_EVENT, { detail }),
  );
}

export function isLocalRangeClipReadyEvent(
  event: Event,
): event is CustomEvent<LocalRangeClipReadyDetail> {
  if (!(event instanceof CustomEvent)) return false;
  const detail = event.detail as Partial<LocalRangeClipReadyDetail> | undefined;
  return Boolean(
    detail &&
      typeof detail.materialId === "string" &&
      typeof detail.rangeId === "string" &&
      detail.file instanceof File,
  );
}
