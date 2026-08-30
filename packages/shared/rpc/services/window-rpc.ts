import type { RpcTarget } from "capnweb";

import type { WindowState } from "#shared/window";

import type { RpcSubscriptionResult } from "../transport/stream";

export interface WindowService extends RpcTarget {
  minimize(): void;
  toggleMaximize(): WindowState;
  close(): void;
  setTitle(title: string): void;
  subscribeState(): RpcSubscriptionResult<WindowState>;
}
