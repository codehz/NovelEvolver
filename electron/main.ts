import { join } from "node:path";

import { app, BrowserWindow, ipcMain } from "electron";

import { ProjectsDatabase } from "./projects-db";
import { ElectronRpcServer } from "./rpc/connect";
import { WorktreesStore } from "./worktrees-store";

const isDev = !app.isPackaged;

let projectsDb: ProjectsDatabase | null = null;
let worktreesStore: WorktreesStore | null = null;
let rpcServer: ElectronRpcServer | null = null;

function getProjectsDb(): ProjectsDatabase {
  if (!projectsDb) {
    throw new Error("Projects database is not initialized.");
  }

  return projectsDb;
}

function getWorktreesStore(): WorktreesStore {
  if (!worktreesStore) {
    throw new Error("Worktrees store is not initialized.");
  }

  return worktreesStore;
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
  projectsDb = new ProjectsDatabase(join(userData, "projects.db"));
  worktreesStore = new WorktreesStore(join(userData, "worktrees.db"));
  rpcServer = new ElectronRpcServer({
    getProjectsDb,
    getWorktreesStore,
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
  worktreesStore?.close();
  worktreesStore = null;
  projectsDb?.close();
  projectsDb = null;
  rpcServer = null;
});
