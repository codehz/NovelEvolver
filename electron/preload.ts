import { contextBridge, ipcRenderer } from "electron";

type WindowState = {
  isMaximized: boolean;
  platform: NodeJS.Platform;
};

contextBridge.exposeInMainWorld("electronAPI", {
  getVersions: () =>
    ipcRenderer.invoke("app:get-versions") as Promise<{
      chrome: string;
      electron: string;
      node: string;
    }>,
  getWindowState: () => ipcRenderer.invoke("window:get-state") as Promise<WindowState>,
  minimizeWindow: () => ipcRenderer.invoke("window:minimize") as Promise<void>,
  toggleMaximizeWindow: () =>
    ipcRenderer.invoke("window:toggle-maximize") as Promise<WindowState>,
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
