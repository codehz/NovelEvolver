import { RpcTarget, type RpcStub } from "capnweb";
import type { BrowserWindow } from "electron";

import type {
  WindowService,
  WindowStateListener,
  WindowStateSubscription,
} from "@shared/rpc/window-rpc";
import type { WindowState } from "@shared/window";
import type { RpcMainDeps } from "./deps";

type WindowSubscriptionRecord = {
  listener: RpcStub<WindowStateListener>;
};

export class WindowStateSubscriptionImpl extends RpcTarget implements WindowStateSubscription {
  readonly #service: WindowServiceImpl;
  readonly #id: number;
  #unsubscribed = false;

  constructor(service: WindowServiceImpl, id: number) {
    super();
    this.#service = service;
    this.#id = id;
  }

  async unsubscribe(): Promise<void> {
    if (this.#unsubscribed) {
      return;
    }

    this.#unsubscribed = true;
    this.#service.removeSubscription(this.#id);
  }

  [Symbol.dispose](): void {
    void this.unsubscribe();
  }
}

export class WindowServiceImpl extends RpcTarget implements WindowService {
  readonly #window: BrowserWindow;
  readonly #deps: RpcMainDeps;
  readonly #subscriptions = new Map<number, WindowSubscriptionRecord>();
  #nextSubscriptionId = 1;
  #disposed = false;

  constructor(window: BrowserWindow, deps: RpcMainDeps) {
    super();
    this.#window = window;
    this.#deps = deps;
  }

  get state(): WindowState {
    return this.#deps.getWindowState(this.#window);
  }

  async minimize(): Promise<void> {
    this.#window.minimize();
  }

  async toggleMaximize(): Promise<WindowState> {
    if (this.#window.isMaximized()) {
      this.#window.unmaximize();
    } else {
      this.#window.maximize();
    }

    return this.state;
  }

  async close(): Promise<void> {
    this.#window.close();
  }

  async setTitle(title: string): Promise<void> {
    this.#window.setTitle(title);
  }

  async subscribeState(listener: RpcStub<WindowStateListener>): Promise<WindowStateSubscription> {
    const id = this.#nextSubscriptionId++;
    const subscription = new WindowStateSubscriptionImpl(this, id);

    this.#subscriptions.set(id, { listener });

    try {
      await listener.onStateChanged(this.state);
    } catch {
      this.removeSubscription(id);
      throw new Error("Failed to establish window state subscription.");
    }

    return subscription;
  }

  async emitStateChanged(): Promise<void> {
    if (this.#disposed) {
      return;
    }

    const state = this.state;

    for (const [id, record] of this.#subscriptions) {
      try {
        await record.listener.onStateChanged(state);
      } catch {
        this.removeSubscription(id);
      }
    }
  }

  removeSubscription(id: number): void {
    const record = this.#subscriptions.get(id);
    if (!record) {
      return;
    }

    this.#subscriptions.delete(id);
    record.listener[Symbol.dispose]();
  }

  [Symbol.dispose](): void {
    if (this.#disposed) {
      return;
    }

    this.#disposed = true;

    for (const id of this.#subscriptions.keys()) {
      this.removeSubscription(id);
    }
  }
}
