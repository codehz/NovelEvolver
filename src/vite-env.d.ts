/// <reference types="vite/client" />

import type { AppInvokeIpc, AppOnIpcEvent } from "@shared/ipc/renderer";

declare global {
  interface Window {
    invokeIpc: AppInvokeIpc;
    onIpcEvent: AppOnIpcEvent;
  }
}

export {};
