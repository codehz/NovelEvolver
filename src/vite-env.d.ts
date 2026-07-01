/// <reference types="vite/client" />

import type { AppRpcTransportBridge } from "#shared/rpc/bridge";

declare global {
  interface Window {
    appRpcBridge: AppRpcTransportBridge;
  }
}

export {};
