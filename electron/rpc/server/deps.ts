import type { BrowserWindow } from "electron";

import type { AppDatabase } from "../../db/app-database";
import type { AiAgentsStore } from "../../settings/ai-agents-store";
import type { AiModelsStore } from "../../settings/ai-models-store";
import type { AiPromptsStore } from "../../settings/ai-prompts-store";

export type RpcMainDeps = {
  getAppDb: () => AppDatabase;
  getAiModelsStore: () => AiModelsStore;
  getAiAgentsStore: () => AiAgentsStore;
  getAiPromptsStore: () => AiPromptsStore;
  mockAiEnabled: boolean;
  getWindowState: (window: BrowserWindow) => {
    isFocused: boolean;
    isMaximized: boolean;
    platform: string;
  };
};
