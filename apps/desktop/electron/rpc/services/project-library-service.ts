import { existsSync } from "node:fs";

import { RpcTarget } from "capnweb";
import { dialog, type BrowserWindow } from "electron";

import type { ProjectLibraryService } from "#desktop-rpc/services/project-library-service";
import type { ProjectMetadata } from "#domain/project";

import { ProjectsRepository } from "../../db/repositories/projects-repo";
import { openSqliteGitRepository } from "../../lib/nano-git-sqlite";
import { toProjectMetadata } from "../../projects/home-path";
import type { RpcMainDeps } from "../server/deps";

export class ProjectLibraryServiceImpl extends RpcTarget implements ProjectLibraryService {
  readonly #window: BrowserWindow;
  readonly #projects: ProjectsRepository;

  constructor(window: BrowserWindow, deps: RpcMainDeps) {
    super();
    this.#window = window;
    const db = deps.getAppDb().db;
    this.#projects = new ProjectsRepository(db);
  }

  get recentProjects(): ProjectMetadata[] {
    return this.#projects.list().map((record) => toProjectMetadata(record));
  }

  async showOpenDialog(): Promise<ProjectMetadata | null> {
    const result = await dialog.showOpenDialog(this.#window, {
      properties: ["openFile"],
      title: "打开项目文件",
      filters: [{ name: "NovelEvolver 项目", extensions: ["npk"] }],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const path = result.filePaths[0];
    if (!path.toLowerCase().endsWith(".npk")) {
      throw new Error("请选择 .npk 项目文件");
    }

    return toProjectMetadata(this.#projects.upsertByPath(path, Date.now()));
  }

  async showCreateDialog(): Promise<ProjectMetadata | null> {
    const result = await dialog.showSaveDialog(this.#window, {
      title: "创建项目",
      filters: [{ name: "NovelEvolver 项目", extensions: ["npk"] }],
      buttonLabel: "创建",
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    let path = result.filePath;
    if (!path.toLowerCase().endsWith(".npk")) {
      path = `${path}.npk`;
    }

    if (existsSync(path)) {
      throw new Error("该路径已存在项目文件，请选择其他位置或文件名");
    }

    using _opened = openSqliteGitRepository(path);

    return toProjectMetadata(this.#projects.upsertByPath(path, Date.now()));
  }

  removeProject(id: number): boolean {
    // worktree.project_id ON DELETE CASCADE 自动级联清空 worktree 及其
    // manuscript / resource 节点，单条 DELETE 即原子完成，无需手动级联。
    return this.#projects.removeById(id);
  }
}
