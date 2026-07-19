import {
  inspectWorkspacePersistence,
  type StorageLike,
  type WorkspacePersistenceHealth,
} from "./persistence-health.ts";
import {
  commitWorkspaceData,
  getMutationBase,
  getPendingWorkspacePersistenceFailure,
  readPublishedWorkspaceData,
  retryPendingWorkspacePersistence,
  subscribeWorkspaceData,
  type PendingWorkspacePersistenceFailure,
} from "./store-runtime.ts";
import type { AppData } from "./store-types.ts";

export interface WorkspaceTransaction<T> {
  data: AppData;
  value: T;
}

export interface WorkspaceRepository {
  getSnapshot(): AppData;
  getMutationBase(): AppData;
  replace(next: AppData): WorkspacePersistenceHealth;
  update(mutator: (data: AppData) => AppData): WorkspacePersistenceHealth;
  transaction<T>(operation: (data: AppData) => WorkspaceTransaction<T>): T;
  subscribe(listener: () => void): () => void;
  inspect(storage?: StorageLike): WorkspacePersistenceHealth;
  getPendingFailure(): PendingWorkspacePersistenceFailure | null;
  retryPending(): WorkspacePersistenceHealth | null;
  getRecoveryCandidate(): AppData | null;
}

class BrowserWorkspaceRepository implements WorkspaceRepository {
  getSnapshot(): AppData {
    return cloneWorkspaceData(readPublishedWorkspaceData());
  }

  getMutationBase(): AppData {
    return cloneWorkspaceData(getMutationBase());
  }

  replace(next: AppData): WorkspacePersistenceHealth {
    return commitWorkspaceData(next);
  }

  update(mutator: (data: AppData) => AppData): WorkspacePersistenceHealth {
    return this.replace(mutator(this.getMutationBase()));
  }

  transaction<T>(operation: (data: AppData) => WorkspaceTransaction<T>): T {
    const transaction = operation(this.getMutationBase());
    this.replace(transaction.data);
    return transaction.value;
  }

  subscribe(listener: () => void): () => void {
    return subscribeWorkspaceData(listener);
  }

  inspect(storage?: StorageLike): WorkspacePersistenceHealth {
    return inspectWorkspacePersistence(this.getSnapshot(), storage);
  }

  getPendingFailure(): PendingWorkspacePersistenceFailure | null {
    return getPendingWorkspacePersistenceFailure();
  }

  retryPending(): WorkspacePersistenceHealth | null {
    return retryPendingWorkspacePersistence();
  }

  getRecoveryCandidate(): AppData | null {
    return this.getPendingFailure()?.candidate ?? null;
  }
}

function cloneWorkspaceData(data: AppData): AppData {
  return JSON.parse(JSON.stringify(data)) as AppData;
}

export const workspaceRepository: WorkspaceRepository = new BrowserWorkspaceRepository();
