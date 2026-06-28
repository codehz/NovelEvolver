import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  getVersions: () =>
    ipcRenderer.invoke("app:get-versions") as Promise<{
      chrome: string;
      electron: string;
      node: string;
    }>,
});
