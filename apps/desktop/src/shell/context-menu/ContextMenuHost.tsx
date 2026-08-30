import { Menu } from "@base-ui/react/menu";
import { useAtomValue } from "jotai";
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";

import {
  activeContextMenuSessionAtom,
  isContextMenuLeaf,
  isContextMenuSeparator,
  isContextMenuSubmenu,
  type ContextMenuItem,
  type ContextMenuPosition,
  type ContextMenuSession,
} from "#app/shared/lib/context-menu";
import { contextMenuHostApi } from "#app/shared/lib/context-menu/api";

import {
  contextMenuItemAcceleratorClass,
  contextMenuItemChevronClass,
  contextMenuItemClass,
  contextMenuItemLabelClass,
  contextMenuPanelClass,
  contextMenuPositionerClass,
  contextMenuSeparatorClass,
} from "./context-menu-chrome";

/** Ignore outside-press that is still part of the opening right-click gesture. */
const OPEN_GESTURE_GUARD_MS = 50;

function createPointerAnchor(position: ContextMenuPosition) {
  const { x, y } = position;
  return {
    getBoundingClientRect: () => DOMRect.fromRect({ x, y, width: 0, height: 0 }),
  };
}

function itemKey(item: ContextMenuItem, index: number): string {
  if (isContextMenuSeparator(item)) {
    return `sep-${index}`;
  }
  if (isContextMenuLeaf(item)) {
    return item.id;
  }
  return `sub-${item.label}-${index}`;
}

function ContextMenuItems({
  items,
  onSelectLeaf,
}: {
  items: readonly ContextMenuItem[];
  onSelectLeaf: (id: string) => void;
}) {
  return items.map((item, index) => {
    if (isContextMenuSeparator(item)) {
      return <Menu.Separator key={itemKey(item, index)} className={contextMenuSeparatorClass} />;
    }

    if (isContextMenuSubmenu(item)) {
      const enabled = item.enabled !== false;
      return (
        <Menu.SubmenuRoot key={itemKey(item, index)}>
          <Menu.SubmenuTrigger
            disabled={!enabled}
            label={item.label}
            className={contextMenuItemClass}
            delay={150}
            closeDelay={200}
          >
            <span className={contextMenuItemLabelClass}>{item.label}</span>
            <span aria-hidden="true" className={contextMenuItemChevronClass} />
          </Menu.SubmenuTrigger>
          <Menu.Portal>
            <Menu.Positioner
              className={contextMenuPositionerClass}
              side="right"
              align="start"
              sideOffset={-2}
              alignOffset={-4}
              positionMethod="fixed"
            >
              <Menu.Popup className={contextMenuPanelClass}>
                <ContextMenuItems items={item.submenu} onSelectLeaf={onSelectLeaf} />
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.SubmenuRoot>
      );
    }

    const enabled = item.enabled !== false;
    return (
      <Menu.Item
        key={itemKey(item, index)}
        disabled={!enabled}
        label={item.label}
        className={contextMenuItemClass}
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
      </Menu.Item>
    );
  });
}

function ContextMenuSessionView({ session }: { session: ContextMenuSession }) {
  const { requestId, items, position } = session;
  const [open, setOpen] = useState(true);
  const openedAtRef = useRef(performance.now());
  const pendingIdRef = useRef<string | null>(null);
  const settledRef = useRef(false);
  const anchor = useMemo(() => createPointerAnchor(position), [position]);

  const settle = useCallback(() => {
    if (settledRef.current) {
      return;
    }
    settledRef.current = true;
    const id = pendingIdRef.current;
    if (id != null) {
      contextMenuHostApi.resolve(requestId, id);
      return;
    }
    contextMenuHostApi.dismiss(requestId);
  }, [requestId]);

  const selectLeaf = useCallback((id: string) => {
    pendingIdRef.current = id;
  }, []);

  const handleOpenChange = useCallback((next: boolean, details: Menu.Root.ChangeEventDetails) => {
    if (
      !next &&
      details.reason === "outside-press" &&
      performance.now() - openedAtRef.current < OPEN_GESTURE_GUARD_MS
    ) {
      details.cancel();
      return;
    }
    setOpen(next);
  }, []);

  const handleOpenChangeComplete = useCallback(
    (next: boolean) => {
      if (!next) {
        settle();
      }
    },
    [settle],
  );

  return (
    <Menu.Root
      open={open}
      onOpenChange={handleOpenChange}
      onOpenChangeComplete={handleOpenChangeComplete}
    >
      <Menu.Portal>
        <Menu.Positioner
          className={contextMenuPositionerClass}
          anchor={anchor}
          side="bottom"
          align="start"
          sideOffset={0}
          alignOffset={0}
          positionMethod="fixed"
        >
          <Menu.Popup className={contextMenuPanelClass} finalFocus={false}>
            <ContextMenuItems items={items} onSelectLeaf={selectLeaf} />
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

export function ContextMenuHost(): ReactNode {
  const session = useAtomValue(activeContextMenuSessionAtom);
  if (session == null) {
    return null;
  }
  return <ContextMenuSessionView key={session.requestId} session={session} />;
}
