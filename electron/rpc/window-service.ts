import { RpcTarget } from "capnweb";
import type { BrowserWindow } from "electron";

import type { WindowService } from "@shared/rpc/window-rpc";
import type { WindowState } from "@shared/window";
import type { RpcMainDeps } from "./deps";
import { RpcStreamPublisher } from "./stream-publisher";

export class WindowServiceImpl extends RpcTarget implements WindowService {
  readonly #window: BrowserWindow;
  readonly #deps: RpcMainDeps;
  readonly #stateSubscriptions = new RpcStreamPublisher<WindowState>();

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
    return this.#stateSubscriptions.subscribe({
      getInitialValue: () => this.state,
    });
  }

  async emitStateChanged(): Promise<void> {
    this.#stateSubscriptions.emit(this.state);
  }

  [Symbol.dispose](): void {
    this.#stateSubscriptions[Symbol.dispose]();
  }
}
