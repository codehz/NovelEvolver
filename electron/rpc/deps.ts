import type { BrowserWindow } from "electron";

import type { AppDatabase } from "../db/app-database";

export type RpcMainDeps = {
  getAppDb: () => AppDatabase;
  getWindowState: (window: BrowserWindow) => {
    isFocused: boolean;
    isMaximized: boolean;
    platform: string;
  };
};
