import type { AppIpcEventMap, AppIpcMethodMap } from "./app-maps";
import type { InvokeIpc, OnIpcEvent } from "./types";

export type AppInvokeIpc = InvokeIpc<AppIpcMethodMap>;

export type AppOnIpcEvent = OnIpcEvent<AppIpcEventMap>;
