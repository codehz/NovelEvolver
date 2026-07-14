import { memo, type ReactNode } from "react";

import { cn } from "#app/shared/lib/ui/cn";

import { primarySidebarChromeTitleTextClass } from "../sidebar/sidebar-chrome";
import {
  SidebarHeaderActionsPortalProvider,
  SidebarHeaderActionsPortalTarget,
} from "../sidebar/sidebar-header-actions-portal";

const primarySidebarFrameClass = cn("flex min-h-0 w-full shrink-0 flex-col bg-app-surface");

const primarySidebarFrameHeaderClass = cn(
  "flex h-workbench-tab shrink-0 items-center justify-between gap-2 pr-3 pl-5",
);

const primarySidebarFrameBodyClass = cn("flex min-h-0 min-w-0 flex-1 flex-col text-sm");

type PrimarySidebarFrameProps = {
  title: string;
  className?: string;
  "aria-hidden"?: boolean;
  children?: ReactNode;
};

export const PrimarySidebarFrame = memo(function PrimarySidebarFrame({
  title,
  className,
  "aria-hidden": ariaHidden,
  children,
}: PrimarySidebarFrameProps) {
  return (
    <SidebarHeaderActionsPortalProvider>
      <aside
        aria-hidden={ariaHidden}
        aria-label={title}
        className={cn(primarySidebarFrameClass, className)}
      >
        <header className={primarySidebarFrameHeaderClass}>
          <span
            className={cn(
              primarySidebarChromeTitleTextClass,
              "pointer-events-none text-transparent",
            )}
          >
            {title}
          </span>
          <SidebarHeaderActionsPortalTarget
            as="div"
            className="flex shrink-0 items-center gap-0.5"
          />
        </header>

        <div className={primarySidebarFrameBodyClass}>{children}</div>
      </aside>
    </SidebarHeaderActionsPortalProvider>
  );
});
