export const APP_RPC_CONNECT_CHANNEL = "capnweb:connect";
export const APP_RPC_MESSAGE_CHANNEL = "capnweb:message";
export const APP_RPC_DISCONNECT_CHANNEL = "capnweb:disconnect";

export type AppRpcSessionId = string;

export type AppRpcMessageFrame = {
  type: "message";
  sessionId: AppRpcSessionId;
  seq: number;
  payload: string;
};

export type AppRpcDisconnectFrame = {
  type: "disconnect";
  sessionId: AppRpcSessionId;
  reason?: string;
};

export type AppRpcFrame = AppRpcMessageFrame | AppRpcDisconnectFrame;

export type AppRpcConnectResult = {
  sessionId: AppRpcSessionId;
};

export function isAppRpcMessageFrame(frame: AppRpcFrame): frame is AppRpcMessageFrame {
  return frame.type === "message";
}

export function isAppRpcDisconnectFrame(frame: AppRpcFrame): frame is AppRpcDisconnectFrame {
  return frame.type === "disconnect";
}
