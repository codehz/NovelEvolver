import type { IpcMain, IpcMainInvokeEvent, WebContents } from "electron";

import type {
  IpcEventMapBase,
  IpcMainMethodHandlers,
  IpcMethodMapBase,
} from "../shared/ipc/types";

export function registerIpcMethods<M extends IpcMethodMapBase>(
  ipcMain: IpcMain,
  handlers: IpcMainMethodHandlers<M>,
) {
  for (const channel of Object.keys(handlers) as Array<keyof M & string>) {
    const handler = handlers[channel] as unknown as (
      event: IpcMainInvokeEvent,
      ...args: unknown[]
    ) => Promise<unknown>;

    ipcMain.handle(channel, (event, ...args) => handler(event, ...args));
  }
}

export function sendIpcEvent<E extends IpcEventMapBase, K extends keyof E & string>(
  target: WebContents,
  channel: K,
  payload: E[K],
) {
  target.send(channel, payload);
}
