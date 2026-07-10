import type { RpcTarget } from "capnweb";

import type { ContextMenuItem } from "#shared/rpc/context-menu";
import type { RpcSubscriptionResult } from "#shared/rpc/stream";
import type { WindowState } from "#shared/window";

export interface WindowService extends RpcTarget {
  minimize(): void;
  toggleMaximize(): WindowState;
  close(): void;
  setTitle(title: string): void;
  /**
   * Show a native context menu at content-relative coordinates.
   * Resolves to the clicked leaf item `id`, or `null` if dismissed.
   */
  popupContextMenu(items: ContextMenuItem[], x: number, y: number): Promise<string | null>;
  subscribeState(): RpcSubscriptionResult<WindowState>;
}
