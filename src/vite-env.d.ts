/// <reference types="vite/client" />

import type { AppRpcTransportBridge } from "@shared/rpc/bridge";
import type { WindowStateListener } from "@shared/rpc/window-rpc";

declare global {
  interface Window {
    appRpcBridge: AppRpcTransportBridge;
    StateListenerBase: {
      new (): WindowStateListener & Disposable;
    };
  }
}

export {};
