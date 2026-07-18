import { AnimatePresence } from "motion/react";
import {
  Fragment,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

import { cn } from "#app/shared/lib/ui/cn";

import type { TreeDropPreview } from "./tree-drag";
import type { TreeRowLayout } from "./tree-row-layout";
import { TREE_ROW_HEIGHT_PX } from "./tree-row-motion";
import { TreeDropIndicator } from "./TreeDropIndicator";

const DEFAULT_OVERSCAN = 8;

type FlatTreeListProps<TItem> = {
  items: readonly TItem[];
  getItemKey: (item: TItem) => string;
  renderRow: (item: TItem, index: number, layout: TreeRowLayout) => ReactNode;
  className?: string;
  listRef?: RefObject<HTMLUListElement | null>;
  dropPreview?: TreeDropPreview | null;
  dragging?: boolean;
  rowHeight?: number;
  overscan?: number;
  onRequestRename?: () => void;
  onRequestDelete?: () => void | Promise<void>;
  onCancelDrag?: () => void;
};

function getScrollParent(element: HTMLElement | null): HTMLElement | null {
  let node = element?.parentElement ?? null;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

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

type ViewportWindow = {
  scrollTop: number;
  viewportHeight: number;
};

function useScrollParentWindow(listElement: HTMLUListElement | null): ViewportWindow {
  const [viewport, setViewport] = useState<ViewportWindow>({
    scrollTop: 0,
    viewportHeight: 0,
  });

  useLayoutEffect(() => {
    if (listElement === null) {
      return;
    }

    const scrollParent = getScrollParent(listElement);
    if (scrollParent === null) {
      setViewport({
        scrollTop: 0,
        viewportHeight: listElement.getBoundingClientRect().height || 600,
      });
      return;
    }

    let frame = 0;
    const publish = () => {
      frame = 0;
      const parentRect = scrollParent.getBoundingClientRect();
      const listRect = listElement.getBoundingClientRect();
      // 列表顶部相对滚动容器可视顶的距离；列表被滚出上方时为正。
      const relativeScrollTop = Math.max(0, parentRect.top - listRect.top);
      setViewport({
        scrollTop: relativeScrollTop,
        viewportHeight: scrollParent.clientHeight,
      });
    };
    const schedule = () => {
      if (frame !== 0) {
        return;
      }
      frame = requestAnimationFrame(publish);
    };

    publish();
    scrollParent.addEventListener("scroll", schedule, { passive: true });
    const resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(scrollParent);

    return () => {
      if (frame !== 0) {
        cancelAnimationFrame(frame);
      }
      scrollParent.removeEventListener("scroll", schedule);
      resizeObserver.disconnect();
    };
  }, [listElement]);

  return viewport;
}

function computeWindowRange(
  itemCount: number,
  rowHeight: number,
  scrollTop: number,
  viewportHeight: number,
  overscan: number,
): { start: number; end: number } {
  if (itemCount === 0) {
    return { start: 0, end: 0 };
  }
  if (viewportHeight <= 0) {
    // 首帧尚无测量时先渲染一段，避免空白闪烁。
    const fallbackCount = Math.min(itemCount, overscan * 4);
    return { start: 0, end: fallbackCount };
  }

  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const end = Math.min(itemCount, Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscan);
  return { start, end: Math.max(start, end) };
}

export function FlatTreeList<TItem>({
  items,
  getItemKey,
  renderRow,
  className,
  listRef,
  dropPreview = null,
  dragging = false,
  rowHeight = TREE_ROW_HEIGHT_PX,
  overscan = DEFAULT_OVERSCAN,
  onRequestRename,
  onRequestDelete,
  onCancelDrag,
}: FlatTreeListProps<TItem>) {
  const [listElement, setListElement] = useState<HTMLUListElement | null>(null);
  const keys = useMemo(() => items.map(getItemKey), [items, getItemKey]);
  const enterKeySet = useEnterKeySet(keys);
  const listHeight = items.length * rowHeight;
  const { scrollTop, viewportHeight } = useScrollParentWindow(listElement);
  const { start, end } = useMemo(
    () => computeWindowRange(items.length, rowHeight, scrollTop, viewportHeight, overscan),
    [items.length, overscan, rowHeight, scrollTop, viewportHeight],
  );

  const setListNode = (node: HTMLUListElement | null) => {
    setListElement(node);
    if (listRef === undefined) {
      return;
    }
    if ("current" in listRef) {
      listRef.current = node;
    }
  };

  return (
    <ul
      ref={setListNode}
      className={cn("isolate outline-none", className)}
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
        {dropPreview !== null ? <TreeDropIndicator preview={dropPreview} /> : null}
      </AnimatePresence>
      {/*
        虚拟窗口内行不走 AnimatePresence exit：滚动移出不应触发淡出。
        真实新增行仍通过 TreeMotionRow 的 animateEnter 做进入动画。
      */}
      {items.slice(start, end).map((item, offset) => {
        const index = start + offset;
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
    </ul>
  );
}
