import { RpcTarget } from "capnweb";
import { createSqliteRepository } from "nano-git/repository/sqlite";

import type { BranchInfo, ProjectHandle, WorktreeHandle } from "#shared/rpc/projects-rpc";

import type { WorktreeRepository } from "../db/repositories/worktree-repo";
import { WorktreeSession } from "../worktree/session";
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
  readonly #worktrees: WorktreeRepository;
  readonly #worktreeHandles = new Map<string, WorktreeHandle>();

  constructor(projectId: number, repoPath: string, worktrees: WorktreeRepository) {
    super();
    this.#projectId = projectId;
    this.#repo = createSqliteRepository(repoPath);
    this.#worktrees = worktrees;
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
    const existing = this.#worktreeHandles.get(name);
    if (existing !== undefined) {
      return existing;
    }

    const session = new WorktreeSession(
      this.#worktrees,
      this.#repo.objects,
      this.#repo,
      this.#projectId,
      name,
    );
    const handle = new WorktreeHandleImpl(session);
    this.#worktreeHandles.set(name, handle);
    return handle;
  }

  [Symbol.dispose](): void {
    this.#repo[Symbol.dispose]();
  }
}
