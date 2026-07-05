import type { ReactNode } from "react";

import { SlotText } from "#app/components/SlotText";
import { cn } from "#app/lib/cn";

import {
  primarySidebarChromeTitleTextClass,
  sidebarHeaderActionClass,
  sidebarHeaderIconClass,
} from "../sidebar/sidebar-chrome";

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
      className={cn("flex min-h-0 w-64 shrink-0 flex-col bg-app-surface", className)}
      style={{ width }}
    >
      <header
        className={cn(
          "flex h-workbench-tab shrink-0 items-center justify-between gap-2 pr-3 pl-5.5",
        )}
      >
        <SlotText text={title} className={primarySidebarChromeTitleTextClass} />
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
