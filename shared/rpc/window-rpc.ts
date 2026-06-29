import type { RpcSubscriptionStream } from "@shared/rpc/stream";
import type { WindowState } from "@shared/window";

export interface WindowService {
  minimize(): Promise<void>;
  toggleMaximize(): Promise<WindowState>;
  close(): Promise<void>;
  setTitle(title: string): Promise<void>;
  subscribeState(): RpcSubscriptionStream<WindowState>;
}
