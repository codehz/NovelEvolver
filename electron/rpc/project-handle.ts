import type { BranchInfo, ProjectHandle } from "@shared/rpc/projects-rpc";
import { RpcTarget } from "capnweb";
import { createSqliteRepository } from "nano-git/repository/sqlite";

/**
 * Server-side RPC target wrapping a nano-git SQLite repository.
 *
 * Each instance opens a SQLite-backed repository and keeps it alive so that
 * property accessors (e.g. `head`) produce live results. When the RPC session
 * ends the caller should call `[Symbol.dispose]()` to close the underlying
 * SQLite connection.
 */
export class ProjectHandleImpl extends RpcTarget implements ProjectHandle {
  readonly #repo: ReturnType<typeof createSqliteRepository>;

  constructor(repoPath: string) {
    super();
    this.#repo = createSqliteRepository(repoPath);
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

  [Symbol.dispose](): void {
    this.#repo[Symbol.dispose]();
  }
}
