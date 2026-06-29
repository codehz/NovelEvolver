import type { AppRpcConnectResult, AppRpcFrame } from "./transport";

export interface AppRpcTransportBridge {
  connect(): Promise<AppRpcConnectResult>;
  send(frame: AppRpcFrame): Promise<void>;
  disconnect(frame: AppRpcFrame): Promise<void>;
  onMessage(callback: (frame: AppRpcFrame) => void): () => void;
}
