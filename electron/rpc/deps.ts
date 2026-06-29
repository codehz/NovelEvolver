import type { BrowserWindow } from "electron";

import type { ProjectsDatabase } from "../projects-db";

export type RpcMainDeps = {
  getProjectsDb: () => ProjectsDatabase;
  getWindowState: (window: BrowserWindow) => {
    isFocused: boolean;
    isMaximized: boolean;
    platform: string;
  };
};
