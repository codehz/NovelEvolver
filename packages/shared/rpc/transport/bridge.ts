import type { AppRpcConnectResult, AppRpcFrame } from "./protocol";

export interface AppRpcTransportBridge {
  connect(): Promise<AppRpcConnectResult>;
  send(frame: AppRpcFrame): Promise<void>;
  disconnect(frame: AppRpcFrame): Promise<void>;
  onMessage(callback: (frame: AppRpcFrame) => void): () => void;
}
