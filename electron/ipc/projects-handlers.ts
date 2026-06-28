import { dialog } from "electron";

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
    "projects:record-open": async (_event, id) => {
      return deps.getProjectsDb().touchById(id, Date.now());
    },
    "projects:remove": async (_event, id) => {
      return deps.getProjectsDb().removeById(id);
    },
  };
}