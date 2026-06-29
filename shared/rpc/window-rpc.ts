import type { WindowState } from "@shared/window";

export type WindowStateChangeListener = (state: WindowState) => void | Promise<void>;

export interface WindowService {
  readonly state: WindowState;
  minimize(): Promise<void>;
  toggleMaximize(): Promise<WindowState>;
  close(): Promise<void>;
  setTitle(title: string): Promise<void>;
  subscribeState(listener: WindowStateChangeListener): Promise<WindowStateSubscription>;
}

export interface WindowStateSubscription {
  unsubscribe(): Promise<void>;
}
