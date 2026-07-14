import type { RefObject } from "react";

import {
  type OneShotRequestChannel,
  useOneShotRequestConsumer,
} from "#app/shared/lib/ui/one-shot-request";
import { queryTreeRowById } from "#workbench/tree/tree-row-dom";

export function scrollContentTreeRowIntoView(
  listRef: RefObject<HTMLUListElement | null>,
  targetId: string,
): void {
  const row = listRef.current ? queryTreeRowById(listRef.current, targetId) : null;
  row?.scrollIntoView({ block: "nearest" });
}

type ContentTreeRevealHandlers<TSnapshot, TItem> = {
  parentChain: (snapshot: TSnapshot, targetId: string) => readonly { id: string }[];
  revealRoot: (snapshot: TSnapshot) => void;
  expandAncestors: (ancestorIds: readonly string[]) => void;
  selectTarget: (targetId: string, item: TItem) => void;
};

export function useContentTreeReveal<
  TSnapshot extends { rootId: string; nodes: Record<string, unknown> },
  TItem,
>({
  snapshot,
  projection,
  listRef,
  onRevealRequest,
  retryPendingReveal,
  handlers,
}: {
  snapshot: TSnapshot | null;
  projection: { items: readonly TItem[]; rowIndexById: Map<string, number> };
  listRef: RefObject<HTMLUListElement | null>;
  onRevealRequest: OneShotRequestChannel<string>["subscribe"];
  retryPendingReveal: OneShotRequestChannel<string>["replay"];
  handlers: ContentTreeRevealHandlers<TSnapshot, TItem>;
}): void {
  useOneShotRequestConsumer({
    subscribe: onRevealRequest,
    replay: retryPendingReveal,
    retryDeps: [projection.items],
    consume: (targetId) => {
      if (snapshot === null) {
        return "retry";
      }

      const targetNode = snapshot.nodes[targetId];
      if (targetNode === undefined) {
        return "done";
      }

      if (targetId === snapshot.rootId) {
        listRef.current?.scrollIntoView({ block: "start" });
        handlers.revealRoot(snapshot);
        return "done";
      }

      const ancestorIds = handlers
        .parentChain(snapshot, targetId)
        .map((node) => node.id)
        .slice(0, -1);
      handlers.expandAncestors(ancestorIds);

      const itemIndex = projection.rowIndexById.get(targetId);
      const item = itemIndex === undefined ? undefined : projection.items[itemIndex];
      if (item === undefined) {
        return "retry";
      }

      handlers.selectTarget(targetId, item);
      scrollContentTreeRowIntoView(listRef, targetId);
      return "done";
    },
  });
}
