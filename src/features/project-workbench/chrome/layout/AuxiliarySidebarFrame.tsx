import { memo, type ReactNode } from "react";

import { cn } from "#app/shared/lib/ui/cn";

import { primarySidebarChromeTitleTextClass } from "../sidebar/sidebar-chrome";
import {
  SidebarHeaderActionsPortalProvider,
  SidebarHeaderActionsPortalTarget,
} from "../sidebar/sidebar-header-actions-portal";

const auxiliarySidebarFrameClass = cn("flex w-full shrink-0 flex-col bg-app-surface");

const auxiliarySidebarFrameHeaderClass = cn(
  "flex h-workbench-tab shrink-0 items-center justify-between gap-2 pr-3 pl-5",
);

const auxiliarySidebarFrameBodyClass = cn("flex min-h-0 flex-1 flex-col");

export const AuxiliarySidebarFrame = memo(function AuxiliarySidebarFrame({
  className,
  "aria-hidden": ariaHidden,
  children,
}: {
  className?: string;
  "aria-hidden"?: boolean;
  children?: ReactNode;
}) {
  return (
    <SidebarHeaderActionsPortalProvider>
      <aside
        aria-hidden={ariaHidden}
        aria-label="AI 助手"
        className={cn(auxiliarySidebarFrameClass, className)}
      >
        <header className={auxiliarySidebarFrameHeaderClass}>
          <span className={primarySidebarChromeTitleTextClass}>AI 助手</span>
          <SidebarHeaderActionsPortalTarget
            as="div"
            className="flex shrink-0 items-center gap-0.5"
          />
        </header>

        <div className={auxiliarySidebarFrameBodyClass}>{children}</div>
      </aside>
    </SidebarHeaderActionsPortalProvider>
  );
});
