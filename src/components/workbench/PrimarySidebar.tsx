import type { ReactNode } from "react";

import { cn } from "../../lib/cn";
import { sidebarHeaderActionClass, sidebarHeaderIconClass } from "./sidebar-header-chrome";
import type { ActivityViewId } from "./types";

const viewTitles: Record<ActivityViewId, string> = {
  explorer: "资源管理器",
  search: "搜索",
  scm: "源代码管理",
};

export function PrimarySidebar({
  activeView,
  children,
}: {
  activeView: ActivityViewId;
  children?: ReactNode;
}) {
  return (
    <aside
      aria-label={viewTitles[activeView]}
      className="flex w-workbench-sidebar shrink-0 flex-col bg-workbench-sidebar"
    >
      <header className="flex h-workbench-tab shrink-0 items-center justify-between gap-2 px-3 text-xs font-semibold tracking-wide text-workbench-sidebar-title uppercase">
        <span className="truncate">{viewTitles[activeView]}</span>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            aria-label="视图操作（演示）"
            className={sidebarHeaderActionClass}
            type="button"
          >
            <span
              aria-hidden="true"
              className={cn(sidebarHeaderIconClass, "icon-[codicon--ellipsis]")}
            />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto p-2 text-sm">{children}</div>
    </aside>
  );
}