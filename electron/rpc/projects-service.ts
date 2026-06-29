import { existsSync } from "node:fs";

import { RpcTarget } from "capnweb";
import { dialog, type BrowserWindow } from "electron";
import { createSqliteRepository } from "nano-git/repository/sqlite";

import type { ProjectListItem, ProjectRecord } from "@shared/project";
import type { ProjectsService } from "@shared/rpc/projects-rpc";
import { projectWithDisplayPath } from "../home-path";
import type { RpcMainDeps } from "./deps";

export class ProjectsServiceImpl extends RpcTarget implements ProjectsService {
  readonly #window: BrowserWindow;
  readonly #deps: RpcMainDeps;

  constructor(window: BrowserWindow, deps: RpcMainDeps) {
    super();
    this.#window = window;
    this.#deps = deps;
  }

  async listRecents(): Promise<ProjectListItem[]> {
    return this.#deps
      .getProjectsDb()
      .list()
      .map((record) => projectWithDisplayPath(record));
  }

  async getRecent(id: number): Promise<ProjectListItem | null> {
    const record = this.#deps.getProjectsDb().getById(id);
    return record ? projectWithDisplayPath(record) : null;
  }

  async openProjectDialog(): Promise<ProjectRecord | null> {
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

    return this.#deps.getProjectsDb().upsertByPath(path, Date.now());
  }

  async createProjectDialog(): Promise<ProjectRecord | null> {
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

    using _repo = createSqliteRepository(path);

    return this.#deps.getProjectsDb().upsertByPath(path, Date.now());
  }

  async recordOpen(id: number): Promise<ProjectRecord | null> {
    return this.#deps.getProjectsDb().touchById(id, Date.now());
  }

  async removeRecent(id: number): Promise<boolean> {
    return this.#deps.getProjectsDb().removeById(id);
  }
}
