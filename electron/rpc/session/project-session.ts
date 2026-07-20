import { RpcTarget } from "capnweb";
import type { SHA1 } from "nano-git";
import { createSqliteRepository } from "nano-git/repository/sqlite";

import type { ProjectMetadata } from "#shared/project";
import type { MockAiControlHandle, ProjectAi } from "#shared/rpc/ai/index";
import { normalizeGitCredentialHost } from "#shared/rpc/services/index";
import type {
  BranchSummary,
  BranchWorkspace,
  ProjectPushResult,
  ProjectSession,
} from "#shared/rpc/session/index";
import { normalizeHttpsRemoteUrl } from "#shared/rpc/session/index";

import { ProjectAiChatController } from "../../ai/chat/project-ai-chat";
import type { AiChatRepository } from "../../db/repositories/ai-chat-repo";
import type { ProjectDbRecord, ProjectsRepository } from "../../db/repositories/projects-repo";
import type { WorktreeRepository } from "../../db/repositories/worktree-repo";
import { toProjectMetadata } from "../../projects/home-path";
import type { AiAgentsStore } from "../../settings/ai-agents-store";
import type { AiModelsStore } from "../../settings/ai-models-store";
import type { AiRuntimePolicyStore } from "../../settings/ai-runtime-policy-store";
import type { GitCredentialsStore } from "../../settings/git-credentials-store";
import { WorktreeSession } from "../../worktree/session";
import { MockAiControlHandleImpl } from "../handles/mock-ai-control-handle";
import { ProjectAiHandleImpl } from "../handles/project-ai-handle";
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
  readonly #projects: ProjectsRepository;
  readonly #getGitCredentialsStore: () => GitCredentialsStore;
  readonly #branchWorkspaces = new Map<string, BranchWorkspaceEntry>();
  #metadata: ProjectMetadata;
  readonly #aiChat: ProjectAiChatController;
  readonly #ai: ProjectAi;
  readonly #mockAi: MockAiControlHandle | null;
  #remoteUrl: string | null;
  #disposed = false;

  constructor(
    projectId: number,
    repoPath: string,
    worktrees: WorktreeRepository,
    projects: ProjectsRepository,
    projectRecord: ProjectDbRecord,
    aiChatRepository: AiChatRepository,
    mockAiEnabled: boolean,
    getAiModelsStore: () => AiModelsStore,
    getAiAgentsStore: () => AiAgentsStore,
    getAiRuntimePolicyStore: () => AiRuntimePolicyStore,
    getGitCredentialsStore: () => GitCredentialsStore,
  ) {
    super();
    this.#projectId = projectId;
    this.#repo = createSqliteRepository(repoPath);
    this.#worktrees = worktrees;
    this.#projects = projects;
    this.#getGitCredentialsStore = getGitCredentialsStore;
    this.#metadata = toProjectMetadata(projectRecord);
    this.#remoteUrl = projectRecord.remoteUrl;
    this.#aiChat = new ProjectAiChatController({
      projectId,
      repository: aiChatRepository,
      clientLabel: projectRecord.path,
      resolveWorktree: () => this.#resolveCurrentWorktree(),
      mockAiEnabled,
      getAiModelsStore,
      getAiAgentsStore,
      getAiRuntimePolicyStore,
    });
    this.#ai = new ProjectAiHandleImpl(this.#aiChat);
    this.#mockAi = mockAiEnabled ? new MockAiControlHandleImpl(this.#aiChat) : null;
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

  get remoteUrl(): string | null {
    return this.#remoteUrl;
  }

  get ai(): ProjectAi {
    return this.#ai;
  }

  getMockAiControl(): MockAiControlHandle | null {
    return this.#mockAi;
  }

  setRemoteUrl(url: string | null): void {
    this.#assertNotDisposed();
    const next = url === null || url.trim() === "" ? null : normalizeHttpsRemoteUrl(url);
    this.#projects.setRemoteUrl(this.#projectId, next);
    this.#remoteUrl = next;
  }

  setDisplayName(name: string | null): void {
    this.#assertNotDisposed();
    const next = name === null || name.trim() === "" ? null : name.trim();
    this.#projects.setDisplayName(this.#projectId, next);
    this.#metadata = {
      ...this.#metadata,
      displayName: next,
    };
  }

  async pushCurrentBranch(): Promise<ProjectPushResult> {
    this.#assertNotDisposed();

    const remoteUrl = this.#remoteUrl;
    if (remoteUrl === null || remoteUrl === "") {
      throw new Error("尚未配置远程仓库地址。");
    }

    const branchName = this.#repo.getCurrentBranch();
    if (branchName === null || branchName === "") {
      throw new Error("当前处于 detached HEAD，无法推送。");
    }

    const tip = this.#repo.readBranch(branchName);
    if (tip === null) {
      throw new Error("当前分支尚无提交，无法推送。");
    }

    let host: string;
    try {
      host = normalizeGitCredentialHost(remoteUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`远程仓库地址无效：${message}`);
    }

    const credential = this.#getGitCredentialsStore().resolve(host);
    if (credential === null) {
      throw new Error(`未找到「${host}」的 Git 凭证，请到 设置 → Git 凭证 中添加。`);
    }
    if (credential.secret === null || credential.secret === "") {
      throw new Error(`「${host}」凭证缺少密码或 PAT，请到 设置 → Git 凭证 中补全。`);
    }

    let result;
    try {
      result = await this.#repo.push(remoteUrl, {
        auth: {
          username: credential.username,
          password: credential.secret,
        },
      });
    } catch (error) {
      throw new Error(formatPushTransportError(error, host));
    }

    const failed = result.pushedRefs.find((ref) => !ref.success);
    if (failed !== undefined) {
      throw new Error(formatPushRefFailure(failed.error, failed.refName));
    }

    const primary =
      result.pushedRefs.find((ref) => ref.refName === `refs/heads/${branchName}`) ??
      result.pushedRefs[0];
    if (primary === undefined) {
      throw new Error("推送完成但远端未返回引用更新结果。");
    }

    return {
      branchName,
      remoteUrl,
      objectCount: result.objectCount,
      updatedRef: primary.refName,
      oldHash: primary.oldHash,
      newHash: primary.newHash,
    };
  }

  checkoutBranch(name: string): void {
    this.#repo.refs.write("HEAD", `ref: refs/heads/${name}`);
  }

  createBranch(name: string, startCommit?: string): BranchSummary {
    this.#assertNotDisposed();
    const branchName = name.trim();
    if (branchName === "") {
      throw new Error("分支名不能为空");
    }
    if (this.#repo.readBranch(branchName) !== null) {
      throw new Error(`分支已存在：${branchName}`);
    }
    const tipFromStart =
      startCommit !== undefined && startCommit.trim() !== "" ? startCommit.trim() : null;
    const tip = tipFromStart ?? this.currentBranch.commit;
    if (tip === null) {
      throw new Error("当前分支尚无提交，无法创建新分支；请先完成首次提交。");
    }
    try {
      this.#repo.createBranch(branchName, tip as SHA1);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/already exists/i.test(message)) {
        throw new Error(`分支已存在：${branchName}`);
      }
      throw new Error(`创建分支失败：${message}`);
    }
    return {
      name: branchName,
      commit: this.#repo.readBranch(branchName),
    };
  }

  deleteBranch(name: string): void {
    this.#assertNotDisposed();
    const branchName = name.trim();
    if (branchName === "") {
      throw new Error("分支名不能为空");
    }
    if (this.#repo.getCurrentBranch() === branchName) {
      throw new Error(`无法删除当前分支：${branchName}`);
    }
    if (this.#repo.readBranch(branchName) === null) {
      throw new Error(`分支不存在：${branchName}`);
    }

    const openWorkspace = this.#branchWorkspaces.get(branchName);
    if (openWorkspace !== undefined) {
      openWorkspace.workspace[Symbol.dispose]();
      this.#branchWorkspaces.delete(branchName);
    }

    this.#worktrees.deleteWorktree(this.#projectId, branchName);

    try {
      this.#repo.deleteBranch(branchName);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/Cannot delete current branch/i.test(message)) {
        throw new Error(`无法删除当前分支：${branchName}`);
      }
      throw new Error(`删除分支失败：${message}`);
    }
  }

  openBranchWorkspace(name: string): BranchWorkspace {
    return this.#getOrCreateBranchWorkspace(name).workspace;
  }

  #assertNotDisposed(): void {
    if (this.#disposed) {
      throw new Error("Project session has been disposed.");
    }
  }

  #getOrCreateBranchWorkspace(name: string): BranchWorkspaceEntry {
    this.#assertNotDisposed();

    const existing = this.#branchWorkspaces.get(name);
    if (existing !== undefined) {
      // Client-side scope unmount used to dispose workspaces while this map retained
      // the entry; never hand out a zombie with a closed changesPublisher.
      if (!existing.session.disposed) {
        return existing;
      }
      this.#branchWorkspaces.delete(name);
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
    this.#assertNotDisposed();

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

function formatPushTransportError(error: unknown, host: string): string {
  const message = error instanceof Error ? error.message : String(error);
  const statusMatch = message.match(/status\s+(\d{3})/i);
  const status = statusMatch?.[1] !== undefined ? Number(statusMatch[1]) : null;

  if (status === 401 || status === 403) {
    return `推送到「${host}」认证失败（HTTP ${status}），请到 设置 → Git 凭证 检查用户名与密码/PAT。`;
  }
  if (status === 404) {
    return `推送失败：远程仓库不存在或无权访问（HTTP 404）。`;
  }
  if (/Failed to fetch|network|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|fetch failed/i.test(message)) {
    return `推送失败：无法连接远程「${host}」（网络错误）。`;
  }
  if (/non-fast-forward|not a fast-forward|rejected/i.test(message)) {
    return "推送被拒绝：远端有新提交，非快进更新（本应用不支持强制推送）。";
  }
  return `推送失败：${message}`;
}

function formatPushRefFailure(error: string | undefined, refName: string): string {
  const detail = error?.trim() ?? "";
  if (/non-fast-forward|not a fast-forward|rejected/i.test(detail)) {
    return "推送被拒绝：远端有新提交，非快进更新（本应用不支持强制推送）。";
  }
  if (detail !== "") {
    return `推送 ${refName} 失败：${detail}`;
  }
  return `推送 ${refName} 失败。`;
}
