import { RpcTarget } from "capnweb";
import type { SHA1 } from "nano-git";
import { createSqliteRepository } from "nano-git/repository/sqlite";

import type { BranchInfo, ProjectHandle, WorktreeHandle } from "#shared/rpc/projects-rpc";

import type { WorktreesStore } from "../worktrees-store";
import { WorktreeHandleImpl } from "./worktree-handle";

/**
 * Server-side RPC target wrapping a nano-git SQLite repository.
 *
 * Each instance opens a SQLite-backed repository and keeps it alive so that
 * property accessors (e.g. `head`) produce live results. When the RPC session
 * ends the caller should call `[Symbol.dispose]()` to close the underlying
 * SQLite connection.
 */
export class ProjectHandleImpl extends RpcTarget implements ProjectHandle {
  readonly #projectId: number;
  readonly #repo: ReturnType<typeof createSqliteRepository>;
  readonly #worktreesStore: WorktreesStore;

  constructor(projectId: number, repoPath: string, worktreesStore: WorktreesStore) {
    super();
    this.#projectId = projectId;
    this.#repo = createSqliteRepository(repoPath);
    this.#worktreesStore = worktreesStore;
  }

  get head(): BranchInfo {
    return {
      name: this.#repo.getCurrentBranch(),
      commit: this.#repo.readRef("HEAD"),
    };
  }

  get branches(): BranchInfo[] {
    return this.#repo.listBranches().map((name) => ({
      name,
      commit: this.#repo.readBranch(name),
    }));
  }

  switchBranch(name: string) {
    this.#repo.refs.write("HEAD", `ref: refs/heads/${name}`);
  }

  openWorktree(name: string): WorktreeHandle {
    const commit = this.#repo.readBranch(name);
    let baseTree: SHA1;
    if (!commit) {
      baseTree = this.#repo.createTree([]);
    } else {
      const object = this.#repo.catFile(commit);
      if (object.type !== "commit") {
        throw new Error(`Expected commit at ${commit}, got ${object.type}.`);
      }
      baseTree = object.tree;
    }

    if (!this.#worktreesStore.hasWorktree(this.#projectId, name)) {
      this.#worktreesStore.createWorktree(this.#projectId, name, baseTree);
    }

    const worktree = this.#worktreesStore.openWorktree(this.#repo.objects, this.#projectId, name);
    return new WorktreeHandleImpl(worktree, this.#repo.objects, this.#repo, name);
  }

  [Symbol.dispose](): void {
    this.#repo[Symbol.dispose]();
  }
}
