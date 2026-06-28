import type { IpcMainInvokeEvent, WebContents } from "electron";

export type IpcMethodMapBase = Record<string, (...args: never[]) => Promise<unknown>>;

export type IpcEventMapBase = Record<string, unknown>;

export type IpcUnsubscribe = () => void;

export type InvokeIpc<M extends IpcMethodMapBase> = <K extends keyof M>(
  channel: K,
  ...args: Parameters<M[K]>
) => ReturnType<M[K]>;

export type OnIpcEvent<E extends IpcEventMapBase> = <K extends keyof E>(
  channel: K,
  callback: (payload: E[K]) => void,
) => IpcUnsubscribe;

export type IpcMainMethodHandlers<M extends IpcMethodMapBase> = {
  [K in keyof M]: (event: IpcMainInvokeEvent, ...args: Parameters<M[K]>) => ReturnType<M[K]>;
};

export type IpcEventSender<E extends IpcEventMapBase> = <K extends keyof E>(
  target: WebContents,
  channel: K,
  payload: E[K],
) => void;
