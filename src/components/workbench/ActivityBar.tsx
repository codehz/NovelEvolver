import { Link } from "wouter";

import { cn } from "../../lib/cn";
import type { ActivityViewId } from "./types";

type ActivityItem = {
  id: ActivityViewId;
  label: string;
  iconClass: string;
};

const primaryItems: ActivityItem[] = [
  { id: "explorer", label: "资源管理器", iconClass: "icon-[codicon--files]" },
  { id: "search", label: "搜索", iconClass: "icon-[codicon--search]" },
  { id: "scm", label: "源代码管理", iconClass: "icon-[codicon--source-control]" },
];

const activityButtonClass = cn(
  "relative flex h-activity-bar-item w-activity-bar shrink-0 items-center justify-center border-0 bg-transparent p-2.5",
  "text-workbench-activity-bar-foreground transition-colors duration-150",
  "hover:text-workbench-activity-bar-active",
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-badge-background",
);

const activityIconClass =
  "inline-flex size-6 shrink-0 items-center justify-center text-[1.375rem] leading-none";

export function ActivityBar({
  activeView,
  auxiliaryVisible,
  onSelectView,
  onToggleAuxiliary,
}: {
  activeView: ActivityViewId;
  auxiliaryVisible: boolean;
  onSelectView: (view: ActivityViewId) => void;
  onToggleAuxiliary: () => void;
}) {
  return (
    <nav
      aria-label="活动栏"
      className="flex h-full min-h-0 w-activity-bar shrink-0 flex-col bg-workbench-activity-bar"
    >
      <div className="flex flex-col">
        {primaryItems.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              aria-current={isActive ? "page" : undefined}
              aria-label={item.label}
              className={cn(
                activityButtonClass,
                isActive && "text-workbench-activity-bar-active",
              )}
              title={item.label}
              type="button"
              onClick={() => onSelectView(item.id)}
            >
              {isActive ? (
                <span
                  aria-hidden="true"
                  className="absolute left-0 h-6 w-0.5 rounded-r bg-workbench-activity-indicator"
                />
              ) : null}
              <span aria-hidden="true" className={cn(activityIconClass, item.iconClass)} />
            </button>
          );
        })}
      </div>

      <div className="mt-auto flex flex-col">
        <button
          aria-label={auxiliaryVisible ? "隐藏 AI 侧边栏" : "显示 AI 侧边栏"}
          aria-pressed={auxiliaryVisible}
          className={cn(
            activityButtonClass,
            auxiliaryVisible && "text-workbench-activity-bar-active",
          )}
          title="AI 助手面板"
          type="button"
          onClick={onToggleAuxiliary}
        >
          <span
            aria-hidden="true"
            className={cn(
              activityIconClass,
              auxiliaryVisible
                ? "icon-[codicon--layout-sidebar-right]"
                : "icon-[codicon--layout-sidebar-right-off]",
            )}
          />
        </button>
        <Link
          aria-label="返回项目列表"
          className={cn(activityButtonClass, "app-region-no-drag")}
          href="/"
          title="返回项目列表"
        >
          <span aria-hidden="true" className={cn(activityIconClass, "icon-[codicon--home]")} />
        </Link>
      </div>
    </nav>
  );
}