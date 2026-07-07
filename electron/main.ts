import { join } from "node:path";

import { app, BrowserWindow, ipcMain } from "electron";

import { AppDatabase } from "./db/app-database";
import { ElectronRpcServer } from "./rpc/server/connect";

const isDev = !app.isPackaged;

let appDb: AppDatabase | null = null;
let rpcServer: ElectronRpcServer | null = null;

function getAppDb(): AppDatabase {
  if (!appDb) {
    throw new Error("App database is not initialized.");
  }

  return appDb;
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
  rpcServer = new ElectronRpcServer({
    getAppDb,
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
  rpcServer = null;
});
