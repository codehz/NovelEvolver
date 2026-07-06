import { AutoTransition, effects, preset } from "@codehz/auto-transition";
import type { ReactNode } from "react";

import { SlotText } from "#app/components/SlotText";
import { cn } from "#app/lib/cn";
import { contentEditorTabDefaultIconClass } from "#app/pages/ProjectWorkbench/workbench/tree/content-tree-icons";

export type TabItem = {
  id: string;
  label: string;
  active?: boolean;
};

type TabBarProps<T extends TabItem> = {
  tabs: readonly T[];
  onActivate: (id: string) => void;
  onClose?: (id: string) => void;
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
  onActivate,
  onClose,
  renderIcon,
  className,
}: TabBarProps<T>) {
  if (tabs.length === 0) {
    return null;
  }

  return (
    <AutoTransition
      as="div"
      className={cn("flex h-workbench-tab shrink-0 items-stretch bg-window-chrome", className)}
      role="tablist"
      transition={tabTransition}
    >
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={cn(
            "group relative flex max-w-xs cursor-pointer items-center pr-1.5 pl-3 text-sm",
            tab.active
              ? "bg-app-background text-ctp-mauve before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-ctp-mauve before:content-['']"
              : "bg-app-surface text-ctp-subtext0",
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
            <span aria-hidden="true" className={contentEditorTabDefaultIconClass()} />
          )}
          <SlotText className="truncate" text={tab.label} />
          {onClose && (
            <button
              aria-label={`关闭 ${tab.label}`}
              className={cn(
                "ml-1 inline-flex items-center justify-center rounded p-0.5 text-[17px] text-ctp-mauve opacity-0 transition-opacity",
                "group-hover:opacity-100 hover:bg-ctp-text/8",
                tab.active && "opacity-100",
              )}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onClose(tab.id);
              }}
            >
              <span aria-hidden="true" className="icon-[codicon--close]" />
            </button>
          )}
        </div>
      ))}
    </AutoTransition>
  );
}
