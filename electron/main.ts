import { join } from "node:path";

import { app, BrowserWindow, ipcMain } from "electron";

import { AppDatabase } from "./db/app-database";
import { ElectronRpcServer } from "./rpc/server/connect";
import { AiModelsStore } from "./settings/ai-models-store";

const isDev = !app.isPackaged;

let appDb: AppDatabase | null = null;
let aiModelsStore: AiModelsStore | null = null;
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
      enableBlinkFeatures: "OverlayScrollbars",
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
  rpcServer = new ElectronRpcServer({
    getAppDb,
    getAiModelsStore,
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
  rpcServer = null;
});
