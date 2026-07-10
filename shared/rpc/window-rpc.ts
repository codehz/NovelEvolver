import type { RpcTarget } from "capnweb";

import type { RpcSubscriptionResult } from "#shared/rpc/stream";
import type { WindowState } from "#shared/window";

export interface WindowService extends RpcTarget {
  minimize(): void;
  toggleMaximize(): WindowState;
  close(): void;
  setTitle(title: string): void;
  subscribeState(): RpcSubscriptionResult<WindowState>;
}
