import { join } from "node:path";
import { app, BrowserWindow, ipcMain } from "electron";

const isDev = !app.isPackaged;

type WindowState = {
  isMaximized: boolean;
  platform: NodeJS.Platform;
};

function getWindowState(window: BrowserWindow): WindowState {
  return {
    isMaximized: window.isMaximized(),
    platform: process.platform,
  };
}

function sendWindowState(window: BrowserWindow) {
  window.webContents.send("window:state-changed", getWindowState(window));
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    backgroundColor: "#f4efe7",
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
    window.webContents.openDevTools({ mode: "detach" });
    return;
  }

  void window.loadFile(join(__dirname, "../dist/index.html"));
}

void app.whenReady().then(() => {
  ipcMain.handle("app:get-versions", () => ({
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node,
  }));

  ipcMain.handle("window:get-state", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) {
      throw new Error("Window not found for sender.");
    }

    return getWindowState(window);
  });

  ipcMain.handle("window:minimize", (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });

  ipcMain.handle("window:toggle-maximize", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) {
      throw new Error("Window not found for sender.");
    }

    if (window.isMaximized()) {
      window.unmaximize();
    } else {
      window.maximize();
    }

    return getWindowState(window);
  });

  ipcMain.handle("window:close", (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });

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
