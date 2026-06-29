import { RpcTarget } from "capnweb";

import type { WindowState } from "@shared/window";

export interface WindowService {
  readonly state: WindowState;
  minimize(): Promise<void>;
  toggleMaximize(): Promise<WindowState>;
  close(): Promise<void>;
  setTitle(title: string): Promise<void>;
  subscribeState(listener: WindowStateListener): Promise<WindowStateSubscription>;
}

export abstract class WindowStateListener extends RpcTarget {
  abstract onStateChanged(state: WindowState): void | Promise<void>;
}

export interface WindowStateSubscription {
  unsubscribe(): Promise<void>;
}
