import { memo, type ReactNode } from "react";

import { SlotText } from "#app/components/SlotText";
import { cn } from "#app/lib/cn";

import { primarySidebarChromeTitleTextClass } from "../sidebar/sidebar-chrome";
import {
  SidebarHeaderActionsPortalProvider,
  SidebarHeaderActionsPortalTarget,
} from "../sidebar/sidebar-header-actions-portal";

export const PrimarySidebar = memo(function PrimarySidebar({
  title,
  className,
  "aria-hidden": ariaHidden,
  children,
}: {
  title: string;
  className?: string;
  "aria-hidden"?: boolean;
  children?: ReactNode;
}) {
  return (
    <SidebarHeaderActionsPortalProvider>
      <aside
        aria-hidden={ariaHidden}
        aria-label={title}
        className={cn("flex min-h-0 w-full shrink-0 flex-col bg-app-surface", className)}
      >
        <header
          className={cn(
            "flex h-workbench-tab shrink-0 items-center justify-between gap-2 pr-3 pl-5",
          )}
        >
          <SlotText text={title} className={primarySidebarChromeTitleTextClass} />
          <SidebarHeaderActionsPortalTarget
            as="div"
            className="flex shrink-0 items-center gap-0.5"
          />
        </header>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col text-sm">{children}</div>
      </aside>
    </SidebarHeaderActionsPortalProvider>
  );
});
