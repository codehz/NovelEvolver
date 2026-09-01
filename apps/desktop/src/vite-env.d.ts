/// <reference types="vite/client" />

import type { AppRpcTransportBridge } from "@novelevolver/desktop-rpc/transport/index";

declare global {
  interface Window {
    appRpcBridge: AppRpcTransportBridge;
  }
}

export {};
