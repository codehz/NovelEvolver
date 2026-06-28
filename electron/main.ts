import { join } from "node:path";
import { app, BrowserWindow, dialog, ipcMain } from "electron";

import { registerIpcMethods, sendIpcEvent } from "./ipc";
import { ProjectsDatabase } from "./projects-db";
import type { AppIpcMethodMap } from "../shared/ipc/app-maps";
import type { IpcMainMethodHandlers } from "../shared/ipc/types";
import type { WindowState } from "../shared/window";

const isDev = !app.isPackaged;

let projectsDb: ProjectsDatabase | null = null;

function getProjectsDb(): ProjectsDatabase {
  if (!projectsDb) {
    throw new Error("Projects database is not initialized.");
  }

  return projectsDb;
}

function getWindowState(window: BrowserWindow): WindowState {
  return {
    isMaximized: window.isMaximized(),
    platform: process.platform,
  };
}

function sendWindowState(window: BrowserWindow) {
  sendIpcEvent(window.webContents, "window:state-changed", getWindowState(window));
}

function getSenderWindow(event: Electron.IpcMainInvokeEvent) {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) {
    throw new Error("Window not found for sender.");
  }

  return window;
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    backgroundColor: "#1e1e1e",
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.on("maximize", () => {
    sendWindowState(window);
  });

  window.on("unmaximize", () => {
    sendWindowState(window);
  });

  if (isDev) {
    void window.loadURL("http://localhost:5173");
    return;
  }

  void window.loadFile(join(__dirname, "../dist/index.html"));
}

const ipcMethodHandlers = {
  "window:get-state": async (event) => getWindowState(getSenderWindow(event)),
  "window:minimize": async (event) => {
    getSenderWindow(event).minimize();
  },
  "window:toggle-maximize": async (event) => {
    const window = getSenderWindow(event);

    if (window.isMaximized()) {
      window.unmaximize();
    } else {
      window.maximize();
    }

    return getWindowState(window);
  },
  "window:close": async (event) => {
    getSenderWindow(event).close();
  },
  "projects:list": async () => getProjectsDb().list(),
  "projects:open-dialog": async (event) => {
    const window = getSenderWindow(event);
    const result = await dialog.showOpenDialog(window, {
      properties: ["openDirectory"],
      title: "打开项目文件夹",
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const path = result.filePaths[0];
    return getProjectsDb().upsertByPath(path, Date.now());
  },
  "projects:record-open": async (_event, id) => {
    return getProjectsDb().touchById(id, Date.now());
  },
  "projects:remove": async (_event, id) => {
    return getProjectsDb().removeById(id);
  },
} satisfies IpcMainMethodHandlers<AppIpcMethodMap>;

void app.whenReady().then(() => {
  const dbPath = join(app.getPath("userData"), "projects.db");
  projectsDb = new ProjectsDatabase(dbPath);

  registerIpcMethods(ipcMain, ipcMethodHandlers);

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
  projectsDb?.close();
  projectsDb = null;
});

app.on("will-quit", () => {
  projectsDb?.close();
  projectsDb = null;
});
