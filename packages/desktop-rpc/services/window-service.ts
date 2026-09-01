import type { RpcSubscriptionResult } from "@novelevolver/desktop-rpc/transport/stream";
import type { WindowState } from "@novelevolver/domain/window";
import type { RpcTarget } from "capnweb";

export interface WindowService extends RpcTarget {
  minimize(): void;
  toggleMaximize(): WindowState;
  close(): void;
  setTitle(title: string): void;
  subscribeState(): RpcSubscriptionResult<WindowState>;
}
