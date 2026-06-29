import type { RpcSubscriptionStream } from "@shared/rpc/stream";
import type { WindowState } from "@shared/window";
import type { RpcTarget } from "capnweb";

export interface WindowService extends RpcTarget {
  minimize(): void;
  toggleMaximize(): WindowState;
  close(): void;
  setTitle(title: string): void;
  subscribeState(): RpcSubscriptionStream<WindowState>;
}
