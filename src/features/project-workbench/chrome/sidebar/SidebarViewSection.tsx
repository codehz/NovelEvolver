import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";

import { cn } from "#app/shared/lib/ui/cn";
import { Button } from "#app/shared/ui";

import {
  sidebarSectionHeaderButtonClass,
  sidebarSectionHeaderChevronClass,
  sidebarSectionResizeHandleClass,
  sidebarSectionResizeRailClass,
  sidebarSectionResizeSeamClass,
} from "./sidebar-chrome";
import {
  SidebarHeaderActionsPortalProvider,
  SidebarHeaderActionsPortalTarget,
} from "./sidebar-header-actions-portal";

export {
  SIDEBAR_SECTION_HEADER_HEIGHT_PX,
  SIDEBAR_SECTION_RESIZE_STRIP_HEIGHT,
} from "./sidebar-pane-geometry";

const sidebarSectionBodyShellClass = cn("shrink-0 overflow-hidden");
const sidebarSectionBodyScrollClass = cn("h-full min-h-0 overflow-x-hidden overflow-y-auto");

type SidebarViewSectionProps = {
  title: string;
  ariaLabel: string;
  expanded: boolean;
  onToggleExpanded: () => void;
  panelId: string;
  children: ReactNode;
  /** Explicit body height in px. Collapsed panes use 0; content stays mounted. */
  bodyHeight: number;
  bodyClassName?: string;
  sectionStyle?: CSSProperties;
};

export function SidebarViewSection({
  title,
  ariaLabel,
  expanded,
  onToggleExpanded,
  panelId,
  children,
  bodyHeight,
  bodyClassName,
  sectionStyle,
}: SidebarViewSectionProps) {
  return (
    <SidebarHeaderActionsPortalProvider>
      <section
        aria-label={ariaLabel}
        className="flex min-h-0 shrink-0 flex-col"
        style={sectionStyle}
      >
        <div className="flex shrink-0 items-center pr-3">
          <Button
            variant="ghost"
            aria-controls={panelId}
            aria-expanded={expanded}
            className={sidebarSectionHeaderButtonClass}
            onClick={onToggleExpanded}
          >
            <span
              aria-hidden="true"
              className={cn(
                sidebarSectionHeaderChevronClass,
                expanded ? "icon-[codicon--chevron-down]" : "icon-[codicon--chevron-right]",
              )}
            />
            <span className="truncate">{title}</span>
          </Button>
          <SidebarHeaderActionsPortalTarget as="div" className="flex shrink-0 items-center" />
        </div>
        <div
          id={panelId}
          aria-hidden={!expanded}
          className={cn(sidebarSectionBodyShellClass, bodyClassName)}
          style={{ height: bodyHeight }}
        >
          <div className={sidebarSectionBodyScrollClass}>{children}</div>
        </div>
      </section>
    </SidebarHeaderActionsPortalProvider>
  );
}

type SidebarSectionRowResizeHandleProps = {
  active: boolean;
  ariaLabel: string;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
};

export function SidebarSectionRowResizeHandle({
  active,
  ariaLabel,
  onPointerDown,
}: SidebarSectionRowResizeHandleProps) {
  return (
    <div className={sidebarSectionResizeSeamClass}>
      <div
        aria-label={ariaLabel}
        aria-orientation="horizontal"
        className={sidebarSectionResizeHandleClass}
        role="separator"
        onPointerDown={onPointerDown}
      >
        <div
          className={cn(
            sidebarSectionResizeRailClass,
            "absolute inset-x-0 bottom-1",
            active && "opacity-100",
          )}
        />
      </div>
    </div>
  );
}
