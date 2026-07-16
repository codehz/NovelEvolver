import {
  memo,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import { cn } from "#app/shared/lib/ui/cn";
import { SlotText } from "#app/shared/ui";

import { primarySidebarChromeTitleTextClass } from "../sidebar/sidebar-chrome";
import { SidebarResizeSash } from "./SidebarResizeSash";
import { WORKBENCH_SIDEBAR_INSET, sidebarChromeOuterSize } from "./workbench-layout-resolver";

const primarySidebarDockMotionClass = cn("duration-200 ease-out");

const primarySidebarDockHostClass = cn("relative h-full min-h-0 shrink-0 overflow-visible");

const primarySidebarDockSpacerClass = cn(
  "pointer-events-none h-full min-h-0 shrink-0",
  "transition-[width]",
  primarySidebarDockMotionClass,
);

/** Absolute chrome layer: panel + sash share one opacity transition. */
const primarySidebarDockChromeClass = cn(
  "absolute top-0 bottom-0 left-0 z-0 overflow-visible",
  "transition-opacity will-change-[opacity]",
  primarySidebarDockMotionClass,
);

const primarySidebarDockPanelClass = cn("absolute top-0 bottom-0 left-0 overflow-hidden");

const primarySidebarDockSashClass = cn("absolute top-0 bottom-0");

const primarySidebarDockTitleOverlayClass = cn(
  "pointer-events-none absolute inset-x-0 top-0 z-20 flex h-workbench-tab items-center pr-3 pl-5",
);

type PrimarySidebarDockProps = {
  visible: boolean;
  spacerWidth: number;
  panelWidth: number;
  resizeTransitionDisabled: boolean;
  resizeActive: boolean;
  title: string;
  onResizePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  children?: ReactNode;
};

export const PrimarySidebarDock = memo(function PrimarySidebarDock({
  visible,
  spacerWidth,
  panelWidth,
  resizeTransitionDisabled,
  resizeActive,
  title,
  onResizePointerDown,
  children,
}: PrimarySidebarDockProps) {
  const spacerStyle: CSSProperties = { width: spacerWidth };
  const chromeStyle: CSSProperties = {
    width: sidebarChromeOuterSize(panelWidth, "primary"),
  };
  const panelStyle: CSSProperties = { width: panelWidth };
  const sashStyle: CSSProperties = { left: panelWidth, width: WORKBENCH_SIDEBAR_INSET };

  return (
    <div className={primarySidebarDockHostClass}>
      <div
        aria-hidden
        className={cn(primarySidebarDockSpacerClass, resizeTransitionDisabled && "transition-none")}
        style={spacerStyle}
      />
      <div
        className={cn(
          primarySidebarDockChromeClass,
          visible ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        style={chromeStyle}
      >
        <div className={primarySidebarDockPanelClass} style={panelStyle}>
          <div aria-hidden="true" className={primarySidebarDockTitleOverlayClass}>
            <SlotText text={title} className={primarySidebarChromeTitleTextClass} />
          </div>
          {children}
        </div>
        <div className={primarySidebarDockSashClass} style={sashStyle}>
          <SidebarResizeSash
            active={resizeActive}
            ariaLabel="调整主侧边栏宽度"
            onPointerDown={onResizePointerDown}
          />
        </div>
      </div>
    </div>
  );
});
