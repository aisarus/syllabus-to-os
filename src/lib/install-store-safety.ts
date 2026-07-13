import { getDataSnapshot, store, uid, updateData, type MaterialChunk } from "./store";
import { inspectWorkspacePersistence } from "./persistence-health";
import {
  replaceMaterialChunksWithStableIds,
  type IncomingMaterialChunk,
} from "./source-integrity";

let installed = false;

/**
 * Compatibility safety layer for the existing v1 store. It preserves the public
 * store API and localStorage schema while making OCR chunk replacement stable and
 * allowing the Notes editor's existing try/catch to detect a failed local write.
 */
export function installStoreSafetyGuards(): void {
  if (installed) return;
  installed = true;

  const originalUpdateNote = store.updateNote.bind(store);
  store.updateNote = ((id, patch) => {
    originalUpdateNote(id, patch);
    const health = inspectWorkspacePersistence(getDataSnapshot());
    if (!health.ok) throw new Error(health.error ?? "Browser-local save failed.");
  }) as typeof store.updateNote;

  store.replaceMaterialChunksForMaterial = ((
    materialId: string,
    chunks: IncomingMaterialChunk[],
  ): MaterialChunk[] => {
    let created: MaterialChunk[] = [];
    updateData((data) => {
      const result = replaceMaterialChunksWithStableIds(
        data,
        materialId,
        chunks,
        () => uid("chk"),
      );
      created = result.chunks;
      return result.data;
    });
    return created;
  }) as typeof store.replaceMaterialChunksForMaterial;
}

installStoreSafetyGuards();
