import type { WindowState } from "@shared/window";
import { windowService } from "./app-rpc";
import { consumeRpcStream } from "./rpc-stream";

type WindowStateSubscriptionOptions = {
  onState: (state: WindowState) => void;
  onError?: (error: unknown) => void;
};

export function subscribeWindowState({
  onState,
  onError,
}: WindowStateSubscriptionOptions): () => void {
  return consumeRpcStream({
    subscribe: () => windowService.subscribeState(),
    onValue: onState,
    onError,
    cancelReason: "Window state subscription disposed.",
  });
}
