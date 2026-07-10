import { RpcTarget } from "capnweb";
import { Menu, type BrowserWindow, type MenuItemConstructorOptions } from "electron";

import type { ContextMenuItem } from "#shared/rpc/context-menu";
import type { WindowService } from "#shared/rpc/window-rpc";
import type { WindowState } from "#shared/window";

import { RpcStreamPublisher } from "../../lib/stream-publisher";
import type { RpcMainDeps } from "../server/deps";

function toMenuTemplate(
  items: ContextMenuItem[],
  onPick: (id: string) => void,
): MenuItemConstructorOptions[] {
  return items.map((item): MenuItemConstructorOptions => {
    if (item.type === "separator") {
      return { type: "separator" };
    }
    if ("submenu" in item) {
      return {
        label: item.label,
        enabled: item.enabled,
        submenu: item.submenu.map((sub): MenuItemConstructorOptions => {
          if (sub.type === "separator") {
            return { type: "separator" };
          }
          return {
            label: sub.label,
            enabled: sub.enabled,
            accelerator: sub.accelerator,
            click: () => {
              onPick(sub.id);
            },
          };
        }),
      };
    }
    return {
      label: item.label,
      enabled: item.enabled,
      accelerator: item.accelerator,
      click: () => {
        onPick(item.id);
      },
    };
  });
}

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

  popupContextMenu(items: ContextMenuItem[], x: number, y: number): Promise<string | null> {
    if (items.length === 0 || this.#window.isDestroyed()) {
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      let settled = false;
      const settle = (id: string | null) => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(id);
      };

      const menu = Menu.buildFromTemplate(
        toMenuTemplate(items, (id) => {
          settle(id);
        }),
      );
      menu.popup({
        window: this.#window,
        x: Math.round(x),
        y: Math.round(y),
        callback: () => {
          settle(null);
        },
      });
    });
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
