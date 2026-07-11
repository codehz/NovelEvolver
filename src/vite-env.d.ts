/// <reference types="vite/client" />

import type { AppRpcTransportBridge } from "#shared/rpc/transport/index";

declare global {
  interface Window {
    appRpcBridge: AppRpcTransportBridge;
  }
}

export {};
