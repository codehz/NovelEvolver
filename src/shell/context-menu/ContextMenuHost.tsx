import { useAtomValue } from "jotai";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

import {
  activeContextMenuSessionAtom,
  isContextMenuLeaf,
  isContextMenuSeparator,
  isContextMenuSubmenu,
  type ContextMenuItem,
  type ContextMenuSession,
  type ContextMenuSubmenuItem,
} from "#app/shared/lib/context-menu";
import { contextMenuHostApi } from "#app/shared/lib/context-menu/api";

import {
  contextMenuItemAcceleratorClass,
  contextMenuItemChevronClass,
  contextMenuItemClass,
  contextMenuItemLabelClass,
  contextMenuListClass,
  contextMenuPanelClass,
  contextMenuSeparatorClass,
  contextMenuSubmenuPanelClass,
} from "./context-menu-chrome";
import {
  ContextMenuPopoverProvider,
  ContextMenuPopoverTarget,
  useContextMenuRequestClose,
} from "./context-menu-popover";
import {
  computeSubmenuPlacement,
  useAnchoredMenuPlacement,
  type MenuPlacement,
} from "./use-context-menu-position";

const SUBMENU_OPEN_DELAY_MS = 150;
const SUBMENU_CLOSE_DELAY_MS = 200;

type FocusableEntry =
  | { kind: "leaf"; index: number; id: string; enabled: boolean }
  | { kind: "submenu"; index: number; enabled: boolean };

function buildFocusableEntries(items: ContextMenuItem[]): FocusableEntry[] {
  const entries: FocusableEntry[] = [];
  items.forEach((item, index) => {
    if (isContextMenuSeparator(item)) {
      return;
    }
    if (isContextMenuSubmenu(item)) {
      entries.push({
        kind: "submenu",
        index,
        enabled: item.enabled !== false,
      });
      return;
    }
    entries.push({
      kind: "leaf",
      index,
      id: item.id,
      enabled: item.enabled !== false,
    });
  });
  return entries;
}

function firstEnabledFocusIndex(entries: FocusableEntry[]): number {
  const idx = entries.findIndex((entry) => entry.enabled);
  return idx >= 0 ? idx : 0;
}

function nextEnabledFocusIndex(entries: FocusableEntry[], from: number, delta: number): number {
  if (entries.length === 0) {
    return 0;
  }
  let cursor = from;
  for (let step = 0; step < entries.length; step += 1) {
    cursor = (cursor + delta + entries.length) % entries.length;
    if (entries[cursor]?.enabled) {
      return cursor;
    }
  }
  return from;
}

function ContextMenuItemRow({
  item,
  highlighted,
  onHighlight,
  onSelectLeaf,
  onOpenSubmenu,
  itemRef,
}: {
  item: ContextMenuItem;
  highlighted: boolean;
  onHighlight: () => void;
  onSelectLeaf: (id: string) => void;
  onOpenSubmenu: () => void;
  itemRef?: (node: HTMLElement | null) => void;
}) {
  if (isContextMenuSeparator(item)) {
    return <li role="separator" className={contextMenuSeparatorClass} />;
  }

  if (isContextMenuSubmenu(item)) {
    const enabled = item.enabled !== false;
    return (
      <li role="none">
        <button
          ref={itemRef}
          type="button"
          role="menuitem"
          aria-haspopup="menu"
          aria-expanded={highlighted}
          disabled={!enabled}
          data-highlighted={highlighted ? "" : undefined}
          data-disabled={enabled ? undefined : ""}
          className={contextMenuItemClass}
          onMouseEnter={() => {
            if (enabled) {
              onHighlight();
              onOpenSubmenu();
            }
          }}
          onClick={() => {
            if (enabled) {
              onOpenSubmenu();
            }
          }}
        >
          <span className={contextMenuItemLabelClass}>{item.label}</span>
          <span aria-hidden="true" className={contextMenuItemChevronClass} />
        </button>
      </li>
    );
  }

  const enabled = item.enabled !== false;
  return (
    <li role="none">
      <button
        ref={itemRef}
        type="button"
        role="menuitem"
        disabled={!enabled}
        data-highlighted={highlighted ? "" : undefined}
        data-disabled={enabled ? undefined : ""}
        className={contextMenuItemClass}
        onMouseEnter={() => {
          if (enabled) {
            onHighlight();
          }
        }}
        onClick={() => {
          if (enabled) {
            onSelectLeaf(item.id);
          }
        }}
      >
        <span className={contextMenuItemLabelClass}>{item.label}</span>
        {item.accelerator != null && item.accelerator !== "" ? (
          <span className={contextMenuItemAcceleratorClass}>{item.accelerator}</span>
        ) : null}
      </button>
    </li>
  );
}

function ContextMenuSubmenuPanel({
  item,
  parentEl,
  onSelectLeaf,
  onCancelCloseSubmenu,
  onRequestCloseSubmenu,
}: {
  item: ContextMenuSubmenuItem;
  parentEl: HTMLElement | null;
  onSelectLeaf: (id: string) => void;
  onCancelCloseSubmenu: () => void;
  onRequestCloseSubmenu: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<MenuPlacement | null>(null);
  const focusable = useMemo(() => buildFocusableEntries(item.submenu), [item.submenu]);
  const [focusIndex, setFocusIndex] = useState(() => firstEnabledFocusIndex(focusable));
  const itemRefs = useRef<Map<number, HTMLElement>>(new Map());

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (panel == null || parentEl == null) {
      return;
    }
    const measure = () => {
      const rect = panel.getBoundingClientRect();
      setPlacement(
        computeSubmenuPlacement(parentEl.getBoundingClientRect(), {
          width: rect.width,
          height: rect.height,
        }),
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    return () => {
      observer.disconnect();
    };
  }, [parentEl]);

  useEffect(() => {
    const entry = focusable[focusIndex];
    if (entry == null) {
      return;
    }
    itemRefs.current.get(entry.index)?.focus();
  }, [focusIndex, focusable]);

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        event.stopPropagation();
        setFocusIndex((prev) => nextEnabledFocusIndex(focusable, prev, 1));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        setFocusIndex((prev) => nextEnabledFocusIndex(focusable, prev, -1));
        return;
      }
      if (event.key === "ArrowLeft" || event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onRequestCloseSubmenu();
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        const entry = focusable[focusIndex];
        if (entry?.kind === "leaf" && entry.enabled) {
          event.preventDefault();
          event.stopPropagation();
          onSelectLeaf(entry.id);
        }
      }
    },
    [focusIndex, focusable, onRequestCloseSubmenu, onSelectLeaf],
  );

  const highlightedItemIndex = focusable[focusIndex]?.index ?? -1;

  return (
    <div
      ref={panelRef}
      role="menu"
      tabIndex={-1}
      className={contextMenuSubmenuPanelClass}
      style={
        placement != null
          ? { left: placement.left, top: placement.top }
          : { left: -9999, top: 0, visibility: "hidden" }
      }
      onKeyDown={onKeyDown}
      onMouseEnter={onCancelCloseSubmenu}
      onMouseLeave={onRequestCloseSubmenu}
    >
      <ul className={contextMenuListClass}>
        {item.submenu.map((subItem, index) => (
          <ContextMenuItemRow
            key={
              isContextMenuSeparator(subItem)
                ? `sep-${index}`
                : isContextMenuLeaf(subItem)
                  ? subItem.id
                  : `sub-${subItem.label}-${index}`
            }
            item={subItem}
            highlighted={index === highlightedItemIndex}
            onHighlight={() => {
              const fi = focusable.findIndex((entry) => entry.index === index);
              if (fi >= 0) {
                setFocusIndex(fi);
              }
            }}
            onSelectLeaf={onSelectLeaf}
            onOpenSubmenu={() => {
              /* nested submenu: open via highlight path in future; first level only for now */
            }}
            itemRef={(node) => {
              if (node == null) {
                itemRefs.current.delete(index);
              } else {
                itemRefs.current.set(index, node);
              }
            }}
          />
        ))}
      </ul>
    </div>
  );
}

function ContextMenuPanelBody({ session }: { session: ContextMenuSession }) {
  const { requestId, items, position } = session;
  const requestClose = useContextMenuRequestClose();
  const panelRef = useRef<HTMLDivElement>(null);
  const placement = useAnchoredMenuPlacement(panelRef, position);
  const focusable = useMemo(() => buildFocusableEntries(items), [items]);
  const [focusIndex, setFocusIndex] = useState(() => firstEnabledFocusIndex(focusable));
  const [openSubmenuIndex, setOpenSubmenuIndex] = useState<number | null>(null);
  const itemRefs = useRef<Map<number, HTMLElement>>(new Map());
  const openTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (openTimerRef.current != null) {
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      clearTimers();
    },
    [clearTimers],
  );

  const dismiss = useCallback(() => {
    requestClose(() => {
      contextMenuHostApi.dismiss(requestId);
    });
  }, [requestClose, requestId]);

  // Use popover=manual: auto light-dismiss closes on the pointerup of the same
  // right-click that opened the menu. Outside dismiss is handled explicitly,
  // deferred one task so the opening gesture cannot dismiss immediately.
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const panel = panelRef.current;
      if (panel == null) {
        return;
      }
      if (event.composedPath().includes(panel)) {
        return;
      }
      // Primary click / touch, or a new right-click outside the panel.
      if (event.button === 0 || event.button === 2 || event.pointerType !== "mouse") {
        dismiss();
      }
    };

    const timerId = window.setTimeout(() => {
      window.addEventListener("pointerdown", onPointerDown, true);
    }, 0);

    return () => {
      window.clearTimeout(timerId);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [dismiss]);

  const selectLeaf = useCallback(
    (id: string) => {
      clearTimers();
      requestClose(() => {
        contextMenuHostApi.resolve(requestId, id);
      });
    },
    [clearTimers, requestClose, requestId],
  );

  const scheduleOpenSubmenu = useCallback(
    (itemIndex: number) => {
      clearTimers();
      openTimerRef.current = window.setTimeout(() => {
        setOpenSubmenuIndex(itemIndex);
      }, SUBMENU_OPEN_DELAY_MS);
    },
    [clearTimers],
  );

  const cancelCloseSubmenu = useCallback(() => {
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleCloseSubmenu = useCallback(() => {
    cancelCloseSubmenu();
    closeTimerRef.current = window.setTimeout(() => {
      setOpenSubmenuIndex(null);
    }, SUBMENU_CLOSE_DELAY_MS);
  }, [cancelCloseSubmenu]);

  useEffect(() => {
    const entry = focusable[focusIndex];
    if (entry == null) {
      return;
    }
    itemRefs.current.get(entry.index)?.focus();
  }, [focusIndex, focusable, placement]);

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (openSubmenuIndex != null) {
          setOpenSubmenuIndex(null);
          return;
        }
        dismiss();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setFocusIndex((prev) => nextEnabledFocusIndex(focusable, prev, 1));
        setOpenSubmenuIndex(null);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setFocusIndex((prev) => nextEnabledFocusIndex(focusable, prev, -1));
        setOpenSubmenuIndex(null);
        return;
      }
      if (event.key === "Home") {
        event.preventDefault();
        setFocusIndex(firstEnabledFocusIndex(focusable));
        setOpenSubmenuIndex(null);
        return;
      }
      if (event.key === "End") {
        event.preventDefault();
        setFocusIndex(nextEnabledFocusIndex(focusable, -1, 1));
        setOpenSubmenuIndex(null);
        return;
      }
      if (event.key === "ArrowRight") {
        const entry = focusable[focusIndex];
        if (entry?.kind === "submenu" && entry.enabled) {
          event.preventDefault();
          setOpenSubmenuIndex(entry.index);
        }
        return;
      }
      if (event.key === "ArrowLeft") {
        if (openSubmenuIndex != null) {
          event.preventDefault();
          setOpenSubmenuIndex(null);
        }
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        const entry = focusable[focusIndex];
        if (entry == null || !entry.enabled) {
          return;
        }
        event.preventDefault();
        if (entry.kind === "leaf") {
          selectLeaf(entry.id);
          return;
        }
        setOpenSubmenuIndex(entry.index);
      }
    },
    [dismiss, focusIndex, focusable, openSubmenuIndex, selectLeaf],
  );

  const openSubmenuItem =
    openSubmenuIndex != null && isContextMenuSubmenu(items[openSubmenuIndex]!)
      ? (items[openSubmenuIndex] as ContextMenuSubmenuItem)
      : null;
  const openSubmenuParentEl =
    openSubmenuIndex != null ? (itemRefs.current.get(openSubmenuIndex) ?? null) : null;
  const highlightedItemIndex = focusable[focusIndex]?.index ?? -1;

  return (
    <ContextMenuPopoverTarget
      ref={panelRef}
      popover="manual"
      role="menu"
      tabIndex={-1}
      className={contextMenuPanelClass}
      style={
        placement != null
          ? { left: placement.left, top: placement.top }
          : { left: position.x, top: position.y, visibility: "hidden" as const }
      }
      onKeyDown={onKeyDown}
    >
      <ul className={contextMenuListClass}>
        {items.map((item, index) => (
          <ContextMenuItemRow
            key={
              isContextMenuSeparator(item)
                ? `sep-${index}`
                : isContextMenuLeaf(item)
                  ? item.id
                  : `sub-${item.label}-${index}`
            }
            item={item}
            highlighted={index === highlightedItemIndex || openSubmenuIndex === index}
            onHighlight={() => {
              const fi = focusable.findIndex((entry) => entry.index === index);
              if (fi >= 0) {
                setFocusIndex(fi);
              }
              if (!isContextMenuSubmenu(item)) {
                clearTimers();
                setOpenSubmenuIndex(null);
              }
            }}
            onSelectLeaf={selectLeaf}
            onOpenSubmenu={() => {
              if (isContextMenuSubmenu(item) && item.enabled !== false) {
                scheduleOpenSubmenu(index);
              }
            }}
            itemRef={(node) => {
              if (node == null) {
                itemRefs.current.delete(index);
              } else {
                itemRefs.current.set(index, node);
              }
            }}
          />
        ))}
      </ul>
      {openSubmenuItem != null ? (
        <ContextMenuSubmenuPanel
          item={openSubmenuItem}
          parentEl={openSubmenuParentEl}
          onSelectLeaf={selectLeaf}
          onCancelCloseSubmenu={cancelCloseSubmenu}
          onRequestCloseSubmenu={scheduleCloseSubmenu}
        />
      ) : null}
    </ContextMenuPopoverTarget>
  );
}

function ContextMenuSessionView({ session }: { session: ContextMenuSession }) {
  const dismiss = useCallback(() => {
    contextMenuHostApi.dismiss(session.requestId);
  }, [session.requestId]);

  return (
    <ContextMenuPopoverProvider onDismiss={dismiss}>
      <ContextMenuPanelBody session={session} />
    </ContextMenuPopoverProvider>
  );
}

export function ContextMenuHost(): ReactNode {
  const session = useAtomValue(activeContextMenuSessionAtom);
  if (session == null) {
    return null;
  }
  return <ContextMenuSessionView key={session.requestId} session={session} />;
}
