import { AutoTransition, effects, preset } from "@codehz/auto-transition";
import type { ReactNode } from "react";

import { SlotText } from "#app/components/SlotText";
import { cn } from "#app/lib/cn";

export type TabItem = {
  id: string;
  label: string;
  active?: boolean;
};

type TabBarProps = {
  tabs: readonly TabItem[];
  onActivate: (id: string) => void;
  onClose?: (id: string) => void;
  renderIcon?: (tab: TabItem) => ReactNode;
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

export function TabBar({ tabs, onActivate, onClose, renderIcon, className }: TabBarProps) {
  if (tabs.length === 0) {
    return null;
  }

  return (
    <AutoTransition
      as="div"
      className={cn("flex h-workbench-tab shrink-0 items-stretch bg-workbench-tab-bar", className)}
      role="tablist"
      transition={tabTransition}
    >
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={cn(
            "flex max-w-xs cursor-pointer items-center gap-2 px-3 text-sm",
            tab.active
              ? "bg-workbench-tab-active text-app-foreground"
              : "bg-workbench-tab-inactive text-ctp-subtext0",
          )}
          role="tab"
          aria-selected={tab.active}
          onClick={() => onActivate(tab.id)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onActivate(tab.id);
            }
          }}
          tabIndex={0}
        >
          {renderIcon?.(tab) ?? (
            <span aria-hidden="true" className="icon-[codicon--file] text-sm" />
          )}
          <SlotText className="truncate" text={tab.label} />
          {onClose && (
            <button
              aria-label={`关闭 ${tab.label}`}
              className="ml-1 rounded p-0.5 hover:bg-window-button-hover"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onClose(tab.id);
              }}
            >
              <span aria-hidden="true" className="icon-[codicon--close] text-xs" />
            </button>
          )}
        </div>
      ))}
    </AutoTransition>
  );
}
