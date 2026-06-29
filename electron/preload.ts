import { contextBridge, ipcRenderer } from "electron";

import type { AppIpcEventMap, AppIpcMethodMap } from "@shared/ipc/app-maps";
import type { AppInvokeIpc, AppOnIpcEvent } from "@shared/ipc/renderer";

const invokeIpc: AppInvokeIpc = (channel, ...args) =>
  ipcRenderer.invoke(channel as string, ...args) as ReturnType<AppIpcMethodMap[typeof channel]>;

const onIpcEvent: AppOnIpcEvent = (channel, callback) => {
  const listener = (_event: Electron.IpcRendererEvent, payload: AppIpcEventMap[typeof channel]) => {
    callback(payload);
  };

  ipcRenderer.on(channel as string, listener);

  return () => {
    ipcRenderer.off(channel as string, listener);
  };
};

contextBridge.exposeInMainWorld("invokeIpc", invokeIpc);
contextBridge.exposeInMainWorld("onIpcEvent", onIpcEvent);
