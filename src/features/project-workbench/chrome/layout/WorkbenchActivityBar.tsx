import { memo } from "react";
import { Link } from "wouter";

import { cn } from "#app/shared/lib/ui/cn";
import { controlFocusVisibleClass } from "#app/shared/lib/ui/interaction-chrome";
import { IconTooltip } from "#app/shared/ui";

type ActivityItem = {
  id: string;
  label: string;
  iconClass: string;
};

const activityButtonClass = cn(
  "flex size-activity-bar shrink-0 items-center justify-center border-0 bg-transparent p-2.5",
  "text-ctp-overlay0 transition-colors duration-150",
  "hover:text-ctp-mauve",
  controlFocusVisibleClass,
);

const activityIconClass = cn(
  "inline-flex size-6 shrink-0 items-center justify-center text-[1.375rem] leading-none",
);

type WorkbenchActivityBarProps = {
  items: readonly ActivityItem[];
  activeView: string | null;
  primarySidebarVisible: boolean;
  onSelectView: (viewId: string) => void;
};

export const WorkbenchActivityBar = memo(function WorkbenchActivityBar({
  items,
  activeView,
  primarySidebarVisible,
  onSelectView,
}: WorkbenchActivityBarProps) {
  return (
    <nav
      aria-label="活动栏"
      className="relative z-30 flex h-full min-h-0 w-activity-bar shrink-0 flex-col bg-window-chrome"
    >
      <div className="flex flex-col">
        {items.map((item) => {
          const isActive = primarySidebarVisible && activeView === item.id;
          return (
            <IconTooltip key={item.id} label={item.label} side="right">
              <button
                aria-current={isActive ? "page" : undefined}
                aria-expanded={isActive ? true : undefined}
                aria-label={item.label}
                className={cn(activityButtonClass, isActive && "text-ctp-mauve")}
                type="button"
                onClick={() => onSelectView(item.id)}
              >
                <span aria-hidden="true" className={cn(activityIconClass, item.iconClass)} />
              </button>
            </IconTooltip>
          );
        })}
      </div>

      <div className="mt-auto flex flex-col">
        <IconTooltip label="返回项目列表" side="right">
          <Link
            aria-label="返回项目列表"
            className={cn(activityButtonClass, "app-region-no-drag")}
            href="/"
          >
            <span aria-hidden="true" className={cn(activityIconClass, "icon-[codicon--home]")} />
          </Link>
        </IconTooltip>
      </div>
    </nav>
  );
});
