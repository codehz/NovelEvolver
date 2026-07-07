import { RpcTarget } from "capnweb";
import type { BrowserWindow } from "electron";

import type { WorkspaceService } from "#shared/rpc/workspace-rpc";

import { ProjectsRepository } from "../db/repositories/projects-repo";
import { WorktreeRepository } from "../db/repositories/worktree-repo";
import type { RpcMainDeps } from "./deps";
import { ProjectSessionImpl } from "./project-session";

export class WorkspaceServiceImpl extends RpcTarget implements WorkspaceService {
  readonly #projects: ProjectsRepository;
  readonly #worktrees: WorktreeRepository;

  constructor(window: BrowserWindow, deps: RpcMainDeps) {
    super();
    void window;
    const db = deps.getAppDb().db;
    this.#projects = new ProjectsRepository(db);
    this.#worktrees = new WorktreeRepository(db);
  }

  openProject(projectId: number): ProjectSessionImpl {
    const record = this.#projects.touchById(projectId, Date.now());
    if (!record) {
      throw new Error(`Project with id ${projectId} not found`);
    }

    return new ProjectSessionImpl(record.id, record.path, this.#worktrees, record);
  }
}
