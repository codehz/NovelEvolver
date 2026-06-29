import { BrowserWindow, type IpcMainInvokeEvent } from "electron";

import type { WindowState } from "@shared/window";
import { sendIpcEvent } from "./register";

export function getWindowState(window: BrowserWindow): WindowState {
  return {
    isFocused: window.isFocused(),
    isMaximized: window.isMaximized(),
    platform: process.platform,
  };
}

export function sendWindowState(window: BrowserWindow) {
  sendIpcEvent(window.webContents, "window:state-changed", getWindowState(window));
}

export function getSenderWindow(event: IpcMainInvokeEvent): BrowserWindow {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) {
    throw new Error("Window not found for sender.");
  }

  return window;
}
