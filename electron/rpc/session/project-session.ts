import { RpcTarget } from "capnweb";
import { createSqliteRepository } from "nano-git/repository/sqlite";

import type { ProjectMetadata } from "#shared/project";
import type { BranchWorkspace } from "#shared/rpc/branch-workspace-rpc";
import type { BranchSummary, ProjectSession } from "#shared/rpc/project-session-rpc";

import type { ProjectDbRecord } from "../../db/repositories/projects-repo";
import type { WorktreeRepository } from "../../db/repositories/worktree-repo";
import { toProjectMetadata } from "../../projects/home-path";
import { WorktreeSession } from "../../worktree/session";
import { BranchWorkspaceImpl } from "./branch-workspace";

/**
 * Server-side RPC target wrapping a nano-git SQLite repository.
 *
 * Each instance opens a SQLite-backed repository and keeps it alive so that
 * property accessors (e.g. `currentBranch`) produce live results. When the RPC session
 * ends the caller should call `[Symbol.dispose]()` to close the underlying
 * SQLite connection.
 */
export class ProjectSessionImpl extends RpcTarget implements ProjectSession {
  readonly #projectId: number;
  readonly #repo: ReturnType<typeof createSqliteRepository>;
  readonly #worktrees: WorktreeRepository;
  readonly #branchWorkspaces = new Map<string, BranchWorkspaceImpl>();
  readonly #metadata: ProjectMetadata;
  #disposed = false;

  constructor(
    projectId: number,
    repoPath: string,
    worktrees: WorktreeRepository,
    projectRecord: ProjectDbRecord,
  ) {
    super();
    this.#projectId = projectId;
    this.#repo = createSqliteRepository(repoPath);
    this.#worktrees = worktrees;
    this.#metadata = toProjectMetadata(projectRecord);
  }

  get metadata() {
    return this.#metadata;
  }

  get currentBranch(): BranchSummary {
    return {
      name: this.#repo.getCurrentBranch(),
      commit: this.#repo.readRef("HEAD"),
    };
  }

  get branches(): BranchSummary[] {
    return this.#repo.listBranches().map((name) => ({
      name,
      commit: this.#repo.readBranch(name),
    }));
  }

  checkoutBranch(name: string): void {
    this.#repo.refs.write("HEAD", `ref: refs/heads/${name}`);
  }

  openBranchWorkspace(name: string): BranchWorkspace {
    if (this.#disposed) {
      throw new Error("Project session has been disposed.");
    }

    const existing = this.#branchWorkspaces.get(name);
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
    const workspace = new BranchWorkspaceImpl(session, name);
    this.#branchWorkspaces.set(name, workspace);
    return workspace;
  }

  [Symbol.dispose](): void {
    if (this.#disposed) {
      return;
    }

    this.#disposed = true;

    for (const workspace of this.#branchWorkspaces.values()) {
      workspace[Symbol.dispose]();
    }
    this.#branchWorkspaces.clear();
    this.#repo[Symbol.dispose]();
  }
}
