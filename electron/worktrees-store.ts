import type { SHA1 } from "nano-git";
import type { createSqliteRepository } from "nano-git/repository/sqlite";
import { openSqliteVirtualWorktreeDatabase } from "nano-git/worktree/sqlite";

export function encodeWorktreeKey(projectId: number, branchName: string): string {
  return `${projectId}:${branchName}`;
}

export function worktreeKeyPrefixForProject(projectId: number): string {
  return `${projectId}:`;
}

type RepoObjects = ReturnType<typeof createSqliteRepository>["objects"];

export class WorktreesStore {
  readonly #db: ReturnType<typeof openSqliteVirtualWorktreeDatabase>;

  constructor(dbPath: string) {
    this.#db = openSqliteVirtualWorktreeDatabase(dbPath);
  }

  hasWorktree(projectId: number, branchName: string): boolean {
    return this.#db.hasWorktree(encodeWorktreeKey(projectId, branchName));
  }

  createWorktree(projectId: number, branchName: string, baseTree: SHA1): void {
    this.#db.createWorktree(encodeWorktreeKey(projectId, branchName), {
      baseTree: baseTree,
    });
  }

  openWorktree(source: RepoObjects, projectId: number, branchName: string) {
    return this.#db.openWorktree(source, encodeWorktreeKey(projectId, branchName));
  }

  deleteWorktreesForProject(projectId: number): number {
    return this.#db.deleteWorktreesByPrefix(worktreeKeyPrefixForProject(projectId));
  }

  close(): void {
    this.#db[Symbol.dispose]();
  }
}
