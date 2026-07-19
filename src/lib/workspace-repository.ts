import { getDataSnapshot, setData, updateData, type AppData } from "./store.ts";

export interface WorkspaceRepository {
  snapshot(): AppData;
  replace(next: AppData): void;
  transact(mutator: (current: AppData) => AppData): void;
}

export class LocalWorkspaceRepository implements WorkspaceRepository {
  snapshot(): AppData {
    return getDataSnapshot();
  }

  replace(next: AppData): void {
    setData(next);
  }

  transact(mutator: (current: AppData) => AppData): void {
    updateData(mutator);
  }
}

export const workspaceRepository: WorkspaceRepository = new LocalWorkspaceRepository();
