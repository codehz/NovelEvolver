import { AutoTransition, effects, preset } from "@codehz/auto-transition";
import { useEffect, useRef, type ReactNode } from "react";

import { cn } from "#app/shared/lib/ui/cn";

import { editorTabBarClass } from "./editor-chrome";
import { Tab, type TabItem } from "./Tab";

export type { TabItem };

type TabBarProps<T extends TabItem> = {
  tabs: readonly T[];
  activeId: string | null;
  transientId?: string | null;
  onActivate: (id: string) => void;
  onClose?: (id: string) => void;
  onPin?: (id: string) => void;
  renderIcon?: (tab: T) => ReactNode;
  className?: string;
};

const tabEase = "cubic-bezier(0.22, 1, 0.36, 1)";

const tabTransition = preset({
  enter: [effects.fade(0), effects.translate({ x: 0, y: 6 })],
  exit: [effects.fade(0), effects.translate({ x: 0, y: 6 })],
  move: effects.flip(),
  timing: {
    enter: { duration: 220, easing: tabEase },
    exit: { duration: 180, easing: tabEase },
    move: { duration: 280, easing: tabEase },
  },
});

export function TabBar<T extends TabItem>({
  tabs,
  activeId,
  transientId = null,
  onActivate,
  onClose,
  onPin,
  renderIcon,
  className,
}: TabBarProps<T>) {
  const listRef = useRef<HTMLElement | null>(null);
  const tabRefs = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    if (!activeId) {
      return;
    }

    const tab = tabRefs.current.get(activeId);
    const list = listRef.current;
    if (!tab || !list) {
      return;
    }

    const tabCenter = tab.offsetLeft + tab.offsetWidth / 2;
    const targetLeft = tabCenter - list.clientWidth / 2;
    const maxLeft = Math.max(0, list.scrollWidth - list.clientWidth);
    list.scrollTo({
      left: Math.min(Math.max(0, targetLeft), maxLeft),
      behavior: "smooth",
    });
  }, [activeId, tabs]);

  if (tabs.length === 0) {
    return null;
  }

  return (
    <AutoTransition
      ref={listRef}
      as="div"
      className={cn(editorTabBarClass, className)}
      role="tablist"
      transition={tabTransition}
    >
      {tabs.map((tab) => (
        <Tab
          key={tab.id}
          ref={(node) => {
            if (node) {
              tabRefs.current.set(tab.id, node);
            } else {
              tabRefs.current.delete(tab.id);
            }
          }}
          label={tab.label}
          active={tab.id === activeId}
          transient={tab.id === transientId}
          onActivate={() => onActivate(tab.id)}
          onClose={onClose ? () => onClose(tab.id) : undefined}
          onPin={onPin ? () => onPin(tab.id) : undefined}
          icon={renderIcon?.(tab)}
        />
      ))}
    </AutoTransition>
  );
}
