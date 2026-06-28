import { existsSync } from "node:fs";

import { dialog } from "electron";
import { createSqliteRepository } from "nano-git/repository/sqlite";

import type { ProjectsIpcMethodMap } from "../../shared/ipc/app-maps";
import type { IpcMainMethodHandlers } from "../../shared/ipc/types";
import type { IpcMainDeps } from "./deps";
import { getSenderWindow } from "./window-helpers";

export function createProjectsIpcMethodHandlers(
  deps: IpcMainDeps,
): IpcMainMethodHandlers<ProjectsIpcMethodMap> {
  return {
    "projects:list": async () => deps.getProjectsDb().list(),
    "projects:open-dialog": async (event) => {
      const window = getSenderWindow(event);
      const result = await dialog.showOpenDialog(window, {
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

      return deps.getProjectsDb().upsertByPath(path, Date.now());
    },
    "projects:create-dialog": async (event) => {
      const window = getSenderWindow(event);
      const result = await dialog.showSaveDialog(window, {
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

      return deps.getProjectsDb().upsertByPath(path, Date.now());
    },
    "projects:record-open": async (_event, id) => {
      return deps.getProjectsDb().touchById(id, Date.now());
    },
    "projects:remove": async (_event, id) => {
      return deps.getProjectsDb().removeById(id);
    },
  };
}