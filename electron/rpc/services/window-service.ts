import { RpcTarget } from "capnweb";
import type { BrowserWindow } from "electron";

import type { WindowService } from "#shared/rpc/window-rpc";
import type { WindowState } from "#shared/window";

import { RpcStreamPublisher } from "../../lib/stream-publisher";
import type { RpcMainDeps } from "../server/deps";

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

  minimize(): void {
    this.#window.minimize();
  }

  toggleMaximize(): WindowState {
    if (this.#window.isMaximized()) {
      this.#window.unmaximize();
    } else {
      this.#window.maximize();
    }

    return this.state;
  }

  close(): void {
    this.#window.close();
  }

  setTitle(title: string): void {
    this.#window.setTitle(title);
  }

  async subscribeState(): Promise<ReadableStream<WindowState>> {
    return this.#stateSubscriptions.subscribe({
      getInitialValue: () => this.state,
    });
  }

  emitStateChanged(): void {
    this.#stateSubscriptions.emit(this.state);
  }

  [Symbol.dispose](): void {
    this.#stateSubscriptions[Symbol.dispose]();
  }
}
