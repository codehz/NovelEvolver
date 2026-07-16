import { memo, type CSSProperties, type ReactNode } from "react";

import { cn } from "#app/shared/lib/ui/cn";
import { SlotText } from "#app/shared/ui";

import { primarySidebarChromeTitleTextClass } from "../sidebar/sidebar-chrome";

const primarySidebarDockMotionClass = cn("duration-200 ease-out");

const primarySidebarDockHostClass = cn("relative h-full min-h-0 shrink-0 overflow-visible");

const primarySidebarDockSpacerClass = cn(
  "pointer-events-none h-full min-h-0 shrink-0",
  "transition-[width]",
  primarySidebarDockMotionClass,
);

const primarySidebarDockPanelClass = cn(
  "absolute z-0 overflow-hidden",
  "transition-opacity will-change-[opacity]",
  primarySidebarDockMotionClass,
);

const primarySidebarDockTitleOverlayClass = cn(
  "pointer-events-none absolute inset-x-0 top-0 z-20 flex h-workbench-tab items-center pr-3 pl-5",
);

type PrimarySidebarDockProps = {
  visible: boolean;
  spacerWidth: number;
  panelWidth: number;
  resizeTransitionDisabled: boolean;
  title: string;
  children?: ReactNode;
};

export const PrimarySidebarDock = memo(function PrimarySidebarDock({
  visible,
  spacerWidth,
  panelWidth,
  resizeTransitionDisabled,
  title,
  children,
}: PrimarySidebarDockProps) {
  const spacerStyle: CSSProperties = { width: spacerWidth };
  const panelStyle: CSSProperties = {
    top: 0,
    bottom: 0,
    left: 0,
    width: panelWidth,
  };

  return (
    <div className={primarySidebarDockHostClass}>
      <div
        aria-hidden
        className={cn(primarySidebarDockSpacerClass, resizeTransitionDisabled && "transition-none")}
        style={spacerStyle}
      />
      <div
        className={cn(
          primarySidebarDockPanelClass,
          visible ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        style={panelStyle}
      >
        <div aria-hidden="true" className={primarySidebarDockTitleOverlayClass}>
          <SlotText text={title} className={primarySidebarChromeTitleTextClass} />
        </div>
        {children}
      </div>
    </div>
  );
});
