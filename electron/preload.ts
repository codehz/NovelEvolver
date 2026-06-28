import { contextBridge, ipcRenderer } from "electron";

import type { WindowState } from "../shared/window";

contextBridge.exposeInMainWorld("electronAPI", {
  getWindowState: () => ipcRenderer.invoke("window:get-state") as Promise<WindowState>,
  minimizeWindow: () => ipcRenderer.invoke("window:minimize") as Promise<void>,
  toggleMaximizeWindow: () => ipcRenderer.invoke("window:toggle-maximize") as Promise<WindowState>,
  closeWindow: () => ipcRenderer.invoke("window:close") as Promise<void>,
  onWindowStateChange: (callback: (state: WindowState) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: WindowState) => {
      callback(state);
    };

    ipcRenderer.on("window:state-changed", listener);

    return () => {
      ipcRenderer.off("window:state-changed", listener);
    };
  },
});
