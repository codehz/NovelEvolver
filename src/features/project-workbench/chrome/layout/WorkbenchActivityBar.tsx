import { memo } from "react";
import { Link } from "wouter";

import { cn } from "#app/shared/lib/ui/cn";
import { Button, AppTooltip } from "#app/shared/ui";

import { activityButtonClass, activityIconClass } from "./activity-bar-chrome";

type ActivityItem = {
  id: string;
  label: string;
  iconClass: string;
};

type ActivityBarIconButtonProps = {
  label: string;
  iconClass: string;
  active?: boolean;
  expanded?: boolean;
  hasPopup?: boolean;
  noDrag?: boolean;
  onClick: () => void;
};

function ActivityBarIconButton({
  label,
  iconClass,
  active = false,
  expanded,
  hasPopup,
  noDrag = false,
  onClick,
}: ActivityBarIconButtonProps) {
  return (
    <AppTooltip label={label} side="right">
      <Button
        variant="ghost"
        aria-current={active ? "page" : undefined}
        aria-expanded={expanded}
        aria-haspopup={hasPopup ? "dialog" : undefined}
        aria-label={label}
        className={cn(
          activityButtonClass,
          active && "text-ctp-mauve",
          noDrag && "app-region-no-drag",
        )}
        onClick={onClick}
      >
        <span aria-hidden="true" className={cn(activityIconClass, iconClass)} />
      </Button>
    </AppTooltip>
  );
}

type WorkbenchActivityBarProps = {
  items: readonly ActivityItem[];
  activeView: string;
  primarySidebarVisible: boolean;
  settingsOpen: boolean;
  onSelectView: (viewId: string) => void;
  onOpenSettings: () => void;
};

export const WorkbenchActivityBar = memo(function WorkbenchActivityBar({
  items,
  activeView,
  primarySidebarVisible,
  settingsOpen,
  onSelectView,
  onOpenSettings,
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
            <ActivityBarIconButton
              key={item.id}
              active={isActive}
              expanded={isActive || undefined}
              iconClass={item.iconClass}
              label={item.label}
              onClick={() => {
                onSelectView(item.id);
              }}
            />
          );
        })}
      </div>

      <div className="mt-auto flex flex-col">
        <ActivityBarIconButton
          expanded={settingsOpen || undefined}
          hasPopup
          iconClass="icon-[codicon--settings-gear]"
          label="设置"
          noDrag
          onClick={onOpenSettings}
        />
        <AppTooltip label="返回项目列表" side="right">
          <Link
            aria-label="返回项目列表"
            className={cn(activityButtonClass, "app-region-no-drag")}
            href="/"
          >
            <span aria-hidden="true" className={cn(activityIconClass, "icon-[codicon--home]")} />
          </Link>
        </AppTooltip>
      </div>
    </nav>
  );
});
