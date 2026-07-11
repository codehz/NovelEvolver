import type { BrowserWindow } from "electron";

import type { AppDatabase } from "../../db/app-database";
import type { AiModelsStore } from "../../settings/ai-models-store";

export type RpcMainDeps = {
  getAppDb: () => AppDatabase;
  getAiModelsStore: () => AiModelsStore;
  mockAiEnabled: boolean;
  getWindowState: (window: BrowserWindow) => {
    isFocused: boolean;
    isMaximized: boolean;
    platform: string;
  };
};
