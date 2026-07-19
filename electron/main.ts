import { join } from "node:path";

import { app, BrowserWindow, ipcMain } from "electron";

import { AppDatabase } from "./db/app-database";
import { ElectronRpcServer } from "./rpc/server/connect";
import { AiAgentsStore } from "./settings/ai-agents-store";
import { AiModelsStore } from "./settings/ai-models-store";
import { AiPromptsStore } from "./settings/ai-prompts-store";
import { AiRuntimePolicyStore } from "./settings/ai-runtime-policy-store";

app.commandLine.appendSwitch("enable-features", "OverlayScrollbar");

const isDev = !app.isPackaged;

let appDb: AppDatabase | null = null;
let aiModelsStore: AiModelsStore | null = null;
let aiAgentsStore: AiAgentsStore | null = null;
let aiPromptsStore: AiPromptsStore | null = null;
let aiRuntimePolicyStore: AiRuntimePolicyStore | null = null;
let rpcServer: ElectronRpcServer | null = null;

function getAppDb(): AppDatabase {
  if (!appDb) {
    throw new Error("App database is not initialized.");
  }

  return appDb;
}

function getAiModelsStore(): AiModelsStore {
  if (!aiModelsStore) {
    throw new Error("AI models store is not initialized.");
  }

  return aiModelsStore;
}

function getAiAgentsStore(): AiAgentsStore {
  if (!aiAgentsStore) {
    throw new Error("AI agents store is not initialized.");
  }
  return aiAgentsStore;
}

function getAiPromptsStore(): AiPromptsStore {
  if (!aiPromptsStore) {
    throw new Error("AI prompts store is not initialized.");
  }
  return aiPromptsStore;
}

function getAiRuntimePolicyStore(): AiRuntimePolicyStore {
  if (!aiRuntimePolicyStore) {
    throw new Error("AI runtime policy store is not initialized.");
  }
  return aiRuntimePolicyStore;
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    title: "NovelEvolver",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    backgroundColor: "#1e1e1e",
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  rpcServer?.attachWindow(window);

  if (isDev) {
    void window.loadURL("http://localhost:5173");
    return;
  }

  void window.loadFile(join(__dirname, "../dist/index.html"));
}

void app.whenReady().then(() => {
  const userData = app.getPath("userData");
  appDb = new AppDatabase(join(userData, "app-state.db"));
  aiModelsStore = new AiModelsStore(join(userData, "ai-settings.json"));
  aiAgentsStore = new AiAgentsStore(join(userData, "ai-agents.json"), getAiModelsStore);
  aiPromptsStore = new AiPromptsStore(join(userData, "ai-prompts.json"));
  aiRuntimePolicyStore = new AiRuntimePolicyStore(join(userData, "ai-runtime-policy.json"));
  rpcServer = new ElectronRpcServer({
    getAppDb,
    getAiModelsStore,
    getAiAgentsStore,
    getAiPromptsStore,
    getAiRuntimePolicyStore,
    mockAiEnabled: process.env.NOVEL_EVOLVER_MOCK_AI === "1",
    getWindowState: (window) => ({
      isFocused: window.isFocused(),
      isMaximized: window.isMaximized(),
      platform: process.platform,
    }),
  });
  rpcServer.register(ipcMain);

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  appDb?.close();
  appDb = null;
  aiModelsStore = null;
  aiAgentsStore = null;
  aiPromptsStore = null;
  aiRuntimePolicyStore = null;
  rpcServer = null;
});
