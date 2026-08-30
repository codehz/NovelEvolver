import { RpcTarget } from "capnweb";
import type { BrowserWindow } from "electron";

import type { WorkspaceService } from "#desktop-rpc/services/workspace-service";

import { AiChatRepository } from "../../db/repositories/ai-chat-repo";
import { ProjectsRepository } from "../../db/repositories/projects-repo";
import { WorktreeRepository } from "../../db/repositories/worktree-repo";
import type { RpcMainDeps } from "../server/deps";
import { ProjectSessionImpl } from "../session/project-session";

export class WorkspaceServiceImpl extends RpcTarget implements WorkspaceService {
  readonly #projects: ProjectsRepository;
  readonly #worktrees: WorktreeRepository;
  readonly #aiChat: AiChatRepository;
  readonly #mockAiEnabled: boolean;
  readonly #getAiModelsStore: RpcMainDeps["getAiModelsStore"];
  readonly #getAiAgentsStore: RpcMainDeps["getAiAgentsStore"];
  readonly #getAiRuntimePolicyStore: RpcMainDeps["getAiRuntimePolicyStore"];
  readonly #getGitCredentialsStore: RpcMainDeps["getGitCredentialsStore"];
  readonly #openSessions = new Set<ProjectSessionImpl>();

  constructor(window: BrowserWindow, deps: RpcMainDeps) {
    super();
    void window;
    const db = deps.getAppDb().db;
    this.#projects = new ProjectsRepository(db);
    this.#worktrees = new WorktreeRepository(db);
    this.#aiChat = new AiChatRepository(db);
    this.#mockAiEnabled = deps.mockAiEnabled;
    this.#getAiModelsStore = deps.getAiModelsStore;
    this.#getAiAgentsStore = deps.getAiAgentsStore;
    this.#getAiRuntimePolicyStore = deps.getAiRuntimePolicyStore;
    this.#getGitCredentialsStore = deps.getGitCredentialsStore;
  }

  openProject(projectId: number): ProjectSessionImpl {
    const record = this.#projects.touchById(projectId, Date.now());
    if (!record) {
      throw new Error(`Project with id ${projectId} not found`);
    }

    const session = new ProjectSessionImpl(
      record.id,
      record.path,
      this.#worktrees,
      this.#projects,
      record,
      this.#aiChat,
      this.#mockAiEnabled,
      this.#getAiModelsStore,
      this.#getAiAgentsStore,
      this.#getAiRuntimePolicyStore,
      this.#getGitCredentialsStore,
    );
    this.#openSessions.add(session);
    return session;
  }

  [Symbol.dispose](): void {
    for (const session of this.#openSessions) {
      session[Symbol.dispose]();
    }
    this.#openSessions.clear();
  }
}
