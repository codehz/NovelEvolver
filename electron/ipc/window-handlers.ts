import type { WindowIpcMethodMap } from "@shared/ipc/app-maps";
import type { IpcMainMethodHandlers } from "@shared/ipc/types";
import { getSenderWindow, getWindowState } from "./window-helpers";

export function createWindowIpcMethodHandlers(): IpcMainMethodHandlers<WindowIpcMethodMap> {
  return {
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
    "window:set-title": async (event, title) => {
      getSenderWindow(event).setTitle(title);
    },
  };
}
