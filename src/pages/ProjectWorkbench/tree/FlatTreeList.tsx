import { AnimatePresence } from "motion/react";
import { Fragment, useLayoutEffect, useMemo, useRef } from "react";
import type { ReactNode, RefObject } from "react";

import { cn } from "#app/lib/cn";

import { TREE_ROW_HEIGHT_PX } from "./tree-row-motion";

type TreeRowLayout = {
  animateEnter: boolean;
  height: number;
  y: number;
};

type FlatTreeListProps<TItem> = {
  items: readonly TItem[];
  getItemKey: (item: TItem) => string;
  renderRow: (item: TItem, index: number, layout: TreeRowLayout) => ReactNode;
  className?: string;
  listRef?: RefObject<HTMLUListElement | null>;
  rootDropTarget?: boolean;
  dragging?: boolean;
  rowHeight?: number;
  onRequestRename?: () => void;
  onRequestDelete?: () => void | Promise<void>;
  onCancelDrag?: () => void;
};

function useEnterKeySet(keys: readonly string[]): Set<string> {
  const hasLayoutRef = useRef(false);
  const previousKeysRef = useRef<Set<string>>(new Set());

  const enterKeySet = useMemo(() => {
    const next = new Set<string>();
    if (!hasLayoutRef.current) {
      return next;
    }
    for (const key of keys) {
      if (!previousKeysRef.current.has(key)) {
        next.add(key);
      }
    }
    return next;
  }, [keys]);

  useLayoutEffect(() => {
    hasLayoutRef.current = true;
    previousKeysRef.current = new Set(keys);
  }, [keys]);

  return enterKeySet;
}

export function FlatTreeList<TItem>({
  items,
  getItemKey,
  renderRow,
  className,
  listRef,
  rootDropTarget = false,
  dragging = false,
  rowHeight = TREE_ROW_HEIGHT_PX,
  onRequestRename,
  onRequestDelete,
  onCancelDrag,
}: FlatTreeListProps<TItem>) {
  const keys = useMemo(() => items.map(getItemKey), [items, getItemKey]);
  const enterKeySet = useEnterKeySet(keys);
  const listHeight = items.length * rowHeight;

  return (
    <ul
      ref={listRef}
      className={cn("outline-none", rootDropTarget && "bg-resource-drop-target", className)}
      role="tree"
      style={{ height: listHeight, position: "relative" }}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "F2") {
          event.preventDefault();
          onRequestRename?.();
          return;
        }
        if (event.key === "Delete") {
          event.preventDefault();
          void onRequestDelete?.();
          return;
        }
        if (event.key === "Escape" && dragging) {
          event.preventDefault();
          onCancelDrag?.();
        }
      }}
    >
      <AnimatePresence initial={false}>
        {items.map((item, index) => {
          const key = keys[index]!;
          return (
            <Fragment key={key}>
              {renderRow(item, index, {
                animateEnter: enterKeySet.has(key),
                y: index * rowHeight,
                height: rowHeight,
              })}
            </Fragment>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}
