import type { ReactNode } from "react";

import { cn } from "#app/lib/cn";

import { sidebarHeaderActionClass, sidebarHeaderIconClass } from "../sidebar/sidebar-header-chrome";

export function PrimarySidebar({
  title,
  width,
  className,
  "aria-hidden": ariaHidden,
  children,
}: {
  title: string;
  width: number;
  className?: string;
  "aria-hidden"?: boolean;
  children?: ReactNode;
}) {
  return (
    <aside
      aria-hidden={ariaHidden}
      aria-label={title}
      className={cn(
        "flex min-h-0 w-workbench-sidebar shrink-0 flex-col bg-workbench-sidebar",
        className,
      )}
      style={{ width }}
    >
      <header className="flex h-workbench-tab shrink-0 items-center justify-between gap-2 px-3 text-xs font-semibold tracking-wide uppercase">
        <span className="truncate">{title}</span>
        <div className="flex shrink-0 items-center gap-0.5">
          <button aria-label="视图操作（演示）" className={sidebarHeaderActionClass} type="button">
            <span
              aria-hidden="true"
              className={cn(sidebarHeaderIconClass, "icon-[codicon--ellipsis]")}
            />
          </button>
        </div>
      </header>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col p-2 text-sm">{children}</div>
    </aside>
  );
}
