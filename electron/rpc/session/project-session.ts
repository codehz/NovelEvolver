import { RpcTarget } from "capnweb";
import { createSqliteRepository } from "nano-git/repository/sqlite";

import type { ProjectMetadata } from "#shared/project";
import type { AiChatHandle } from "#shared/rpc/ai-rpc";
import type { BranchWorkspace } from "#shared/rpc/branch-workspace-rpc";
import type { BranchSummary, ProjectSession } from "#shared/rpc/project-session-rpc";

import { ProjectAiChatController } from "../../ai/chat/project-ai-chat";
import type { AiChatRepository } from "../../db/repositories/ai-chat-repo";
import type { ProjectDbRecord } from "../../db/repositories/projects-repo";
import type { WorktreeRepository } from "../../db/repositories/worktree-repo";
import { toProjectMetadata } from "../../projects/home-path";
import { WorktreeSession } from "../../worktree/session";
import { AiChatHandleImpl } from "../handles/ai-chat-handle";
import { BranchWorkspaceImpl } from "./branch-workspace";

type BranchWorkspaceEntry = {
  session: WorktreeSession;
  workspace: BranchWorkspaceImpl;
};

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
  readonly #branchWorkspaces = new Map<string, BranchWorkspaceEntry>();
  readonly #metadata: ProjectMetadata;
  readonly #aiChat: ProjectAiChatController;
  readonly #ai: AiChatHandle;
  #disposed = false;

  constructor(
    projectId: number,
    repoPath: string,
    worktrees: WorktreeRepository,
    projectRecord: ProjectDbRecord,
    aiChatRepository: AiChatRepository,
  ) {
    super();
    this.#projectId = projectId;
    this.#repo = createSqliteRepository(repoPath);
    this.#worktrees = worktrees;
    this.#metadata = toProjectMetadata(projectRecord);
    this.#aiChat = new ProjectAiChatController({
      projectId,
      repository: aiChatRepository,
      clientLabel: projectRecord.path,
      resolveWorktree: () => this.#resolveCurrentWorktree(),
    });
    this.#ai = new AiChatHandleImpl(this.#aiChat);
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

  get ai(): AiChatHandle {
    return this.#ai;
  }

  checkoutBranch(name: string): void {
    this.#repo.refs.write("HEAD", `ref: refs/heads/${name}`);
  }

  openBranchWorkspace(name: string): BranchWorkspace {
    return this.#getOrCreateBranchWorkspace(name).workspace;
  }

  #getOrCreateBranchWorkspace(name: string): BranchWorkspaceEntry {
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
    const workspace = new BranchWorkspaceImpl(session);
    const entry = { session, workspace };
    this.#branchWorkspaces.set(name, entry);
    return entry;
  }

  #resolveCurrentWorktree(): WorktreeSession {
    if (this.#disposed) {
      throw new Error("Project session has been disposed.");
    }

    const branchName = this.#repo.getCurrentBranch();
    if (branchName === null || branchName === "") {
      throw new Error("当前处于 detached HEAD，无法解析 AI 工具所需的 worktree。");
    }

    return this.#getOrCreateBranchWorkspace(branchName).session;
  }

  [Symbol.dispose](): void {
    if (this.#disposed) {
      return;
    }

    this.#disposed = true;
    this.#aiChat[Symbol.dispose]();

    for (const entry of this.#branchWorkspaces.values()) {
      entry.workspace[Symbol.dispose]();
    }
    this.#branchWorkspaces.clear();
    this.#repo[Symbol.dispose]();
  }
}
