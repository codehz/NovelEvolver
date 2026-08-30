import type { RpcTarget } from "capnweb";

import type { RpcSubscriptionResult } from "#desktop-rpc/transport/stream";
import type { WindowState } from "#domain/window";

export interface WindowService extends RpcTarget {
  minimize(): void;
  toggleMaximize(): WindowState;
  close(): void;
  setTitle(title: string): void;
  subscribeState(): RpcSubscriptionResult<WindowState>;
}
