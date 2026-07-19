import { memo, type ReactNode } from "react";

import { cn } from "#app/shared/lib/ui/cn";

import {
  SidebarHeaderActionsPortalProvider,
  SidebarHeaderActionsPortalTarget,
} from "../../sidebar/header/sidebar-header-actions-portal";
import {
  sidebarChromeTitleTextClass,
  sidebarPanelSurfaceClass,
} from "../../sidebar/sidebar-chrome";

const sidebarFrameClass = cn("flex min-h-0 w-full shrink-0 flex-col", sidebarPanelSurfaceClass);

const sidebarFrameHeaderClass = cn(
  "flex h-workbench-tab shrink-0 items-center justify-between gap-2 pr-3 pl-5",
);

const sidebarFrameBodyClass = cn("flex min-h-0 min-w-0 flex-1 flex-col text-sm");

type SidebarFrameProps = {
  title: string;
  /** `ghost` keeps layout while a dock-level title overlay paints the visible label. */
  titleMode?: "ghost" | "visible";
  className?: string;
  "aria-hidden"?: boolean;
  children?: ReactNode;
};

export const SidebarFrame = memo(function SidebarFrame({
  title,
  titleMode = "visible",
  className,
  "aria-hidden": ariaHidden,
  children,
}: SidebarFrameProps) {
  return (
    <SidebarHeaderActionsPortalProvider>
      <aside
        aria-hidden={ariaHidden}
        aria-label={title}
        className={cn(sidebarFrameClass, className)}
      >
        <header className={sidebarFrameHeaderClass}>
          <span
            className={cn(
              sidebarChromeTitleTextClass,
              titleMode === "ghost" && "pointer-events-none text-transparent",
            )}
          >
            {title}
          </span>
          <SidebarHeaderActionsPortalTarget
            as="div"
            className="flex shrink-0 items-center gap-0.5"
          />
        </header>

        <div className={sidebarFrameBodyClass}>{children}</div>
      </aside>
    </SidebarHeaderActionsPortalProvider>
  );
});
