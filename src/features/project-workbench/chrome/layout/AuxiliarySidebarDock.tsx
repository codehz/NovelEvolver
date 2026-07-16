import {
  memo,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import { cn } from "#app/shared/lib/ui/cn";

import { AuxiliarySidebarFrame } from "./AuxiliarySidebarFrame";
import { SidebarResizeSash } from "./SidebarResizeSash";
import { WORKBENCH_SIDEBAR_INSET, sidebarChromeOuterSize } from "./workbench-layout-resolver";

const auxiliarySidebarDockMotionClass = cn("duration-200 ease-out");

const auxiliarySidebarDockHostClass = cn("relative h-full min-h-0 shrink-0 overflow-visible");

const auxiliarySidebarDockSpacerClass = cn(
  "pointer-events-none h-full min-h-0 shrink-0",
  "transition-[width]",
  auxiliarySidebarDockMotionClass,
);

/** Absolute chrome layer: sash + panel share one opacity transition. */
const auxiliarySidebarDockChromeClass = cn(
  "absolute top-0 right-0 bottom-0 z-0 overflow-visible",
  "transition-opacity will-change-[opacity]",
  auxiliarySidebarDockMotionClass,
);

const auxiliarySidebarDockPanelClass = cn("absolute top-0 bottom-0 overflow-hidden");

const auxiliarySidebarDockSashClass = cn("absolute top-0 bottom-0 left-0");

type AuxiliarySidebarDockProps = {
  visible: boolean;
  spacerWidth: number;
  panelWidth: number;
  resizeTransitionDisabled: boolean;
  resizeActive: boolean;
  onResizePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  children?: ReactNode;
};

export const AuxiliarySidebarDock = memo(function AuxiliarySidebarDock({
  visible,
  spacerWidth,
  panelWidth,
  resizeTransitionDisabled,
  resizeActive,
  onResizePointerDown,
  children,
}: AuxiliarySidebarDockProps) {
  const spacerStyle: CSSProperties = { width: spacerWidth };
  const chromeStyle: CSSProperties = {
    width: sidebarChromeOuterSize(panelWidth, "auxiliary"),
  };
  const panelStyle: CSSProperties = {
    right: WORKBENCH_SIDEBAR_INSET,
    width: panelWidth,
  };
  const sashStyle: CSSProperties = { width: WORKBENCH_SIDEBAR_INSET };

  return (
    <div className={auxiliarySidebarDockHostClass}>
      <div
        aria-hidden
        className={cn(
          auxiliarySidebarDockSpacerClass,
          resizeTransitionDisabled && "transition-none",
        )}
        style={spacerStyle}
      />
      <div
        className={cn(
          auxiliarySidebarDockChromeClass,
          visible ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        style={chromeStyle}
      >
        <div className={auxiliarySidebarDockSashClass} style={sashStyle}>
          <SidebarResizeSash
            active={resizeActive}
            ariaLabel="调整辅助侧边栏宽度"
            onPointerDown={onResizePointerDown}
          />
        </div>
        <div className={auxiliarySidebarDockPanelClass} style={panelStyle}>
          <AuxiliarySidebarFrame aria-hidden={!visible} className="h-full min-h-0">
            {children}
          </AuxiliarySidebarFrame>
        </div>
      </div>
    </div>
  );
});
