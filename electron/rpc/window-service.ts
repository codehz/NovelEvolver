import { RpcTarget } from "capnweb";
import type { BrowserWindow } from "electron";

import type { WindowService } from "@shared/rpc/window-rpc";
import type { WindowState } from "@shared/window";
import type { RpcMainDeps } from "./deps";

type WindowSubscriptionRecord = {
  controller: ReadableStreamDefaultController<WindowState>;
};

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

  async subscribeState(): Promise<ReadableStream<WindowState>> {
    const id = this.#nextSubscriptionId++;
    const state = this.state;

    return new ReadableStream<WindowState>({
      start: (controller) => {
        if (this.#disposed) {
          controller.close();
          return;
        }

        this.#subscriptions.set(id, { controller });
        controller.enqueue(state);
      },
      cancel: () => {
        this.removeSubscription(id);
      },
    });
  }

  async emitStateChanged(): Promise<void> {
    if (this.#disposed) {
      return;
    }

    const state = this.state;

    for (const [id, record] of this.#subscriptions) {
      try {
        record.controller.enqueue(state);
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
    try {
      record.controller.close();
    } catch {
      // Ignore controllers already closed or canceled by the consumer.
    }
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
