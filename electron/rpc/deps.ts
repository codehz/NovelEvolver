import type { BrowserWindow } from "electron";

import type { ProjectsDatabase } from "../projects-db";
import type { WorktreesStore } from "../worktrees-store";

export type RpcMainDeps = {
  getProjectsDb: () => ProjectsDatabase;
  getWorktreesStore: () => WorktreesStore;
  getWindowState: (window: BrowserWindow) => {
    isFocused: boolean;
    isMaximized: boolean;
    platform: string;
  };
};
