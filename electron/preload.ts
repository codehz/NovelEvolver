import { contextBridge, ipcRenderer } from "electron";

import type { AppRpcTransportBridge } from "@shared/rpc/bridge";
import {
  APP_RPC_CONNECT_CHANNEL,
  APP_RPC_DISCONNECT_CHANNEL,
  APP_RPC_MESSAGE_CHANNEL,
  type AppRpcFrame,
} from "@shared/rpc/transport";
import { WindowStateListener } from "@shared/rpc/window-rpc";

const appRpcBridge: AppRpcTransportBridge = {
  connect: () => ipcRenderer.invoke(APP_RPC_CONNECT_CHANNEL),
  send: (frame) => ipcRenderer.invoke(APP_RPC_MESSAGE_CHANNEL, frame),
  disconnect: (frame) => ipcRenderer.invoke(APP_RPC_DISCONNECT_CHANNEL, frame),
  onMessage: (callback) => {
    const handleMessage = (_event: Electron.IpcRendererEvent, frame: AppRpcFrame) => {
      callback(frame);
    };

    const handleDisconnect = (_event: Electron.IpcRendererEvent, frame: AppRpcFrame) => {
      callback(frame);
    };

    ipcRenderer.on(APP_RPC_MESSAGE_CHANNEL, handleMessage);
    ipcRenderer.on(APP_RPC_DISCONNECT_CHANNEL, handleDisconnect);

    return () => {
      ipcRenderer.off(APP_RPC_MESSAGE_CHANNEL, handleMessage);
      ipcRenderer.off(APP_RPC_DISCONNECT_CHANNEL, handleDisconnect);
    };
  },
};

class PreloadWindowStateListener extends WindowStateListener {
  override onStateChanged(): void | Promise<void> {
    return undefined;
  }
}

contextBridge.exposeInMainWorld("appRpcBridge", appRpcBridge);
contextBridge.exposeInMainWorld("StateListenerBase", PreloadWindowStateListener);
