import { Tabs } from "@base-ui/react/tabs";
import { useEffect, useRef } from "react";

import { cn } from "#app/shared/lib/ui/cn";
import { controlFocusVisibleClass, panelHoverClass } from "#app/shared/lib/ui/interaction-chrome";

/* pb-1.5 matches scrollbar-thin-x track height so the bar does not cover tabs. */
const tabsRailClass = cn("flex scrollbar-thin-x gap-1 overflow-x-auto px-1 pb-1.5");
const tabButtonClass = cn(
  "inline-flex h-6 max-w-40 shrink-0 items-center gap-1 rounded-sm px-2 text-left text-2xs transition-colors outline-none select-none",
  "text-ctp-subtext1",
  panelHoverClass,
  controlFocusVisibleClass,
  "data-active:bg-ctp-surface0/55 data-active:text-app-foreground",
);

/**
 * 多个待回答问题时切换激活条目的标签栏。按 pending input 的稳定 key 渲染，
 * 标签文本来自各条目 DTO 的 `prompt` 摘要。
 */
type AskUserQuestionTabsProps = {
  keys: string[];
  summaries: string[];
  activeKey: string | null;
  onSelectKey: (key: string) => void;
};

export function AskUserQuestionTabs({
  keys,
  summaries,
  activeKey,
  onSelectKey,
}: AskUserQuestionTabsProps) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    if (!activeKey) {
      return;
    }

    const tab = tabRefs.current.get(activeKey);
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
  }, [activeKey, keys]);

  if (keys.length <= 1) {
    return null;
  }

  return (
    <Tabs.Root
      value={activeKey}
      onValueChange={(next) => {
        if (typeof next === "string") {
          onSelectKey(next);
        }
      }}
    >
      <Tabs.List ref={listRef} className={tabsRailClass}>
        {keys.map((key, index) => {
          const label = summaries[index] ?? `问题 ${index + 1}`;

          return (
            <Tabs.Tab
              key={key}
              value={key}
              className={tabButtonClass}
              title={label}
              ref={(node) => {
                if (node) {
                  tabRefs.current.set(key, node);
                } else {
                  tabRefs.current.delete(key);
                }
              }}
            >
              <span className="truncate">{label}</span>
            </Tabs.Tab>
          );
        })}
      </Tabs.List>
    </Tabs.Root>
  );
}
