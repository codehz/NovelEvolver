import { join } from "node:path";
import { app, BrowserWindow, ipcMain } from "electron";

const isDev = !app.isPackaged;

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#f4efe7",
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
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
