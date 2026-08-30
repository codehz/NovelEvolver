import { Fragment, useMemo, type ReactNode } from "react";

import { cn } from "#app/shared/lib/ui/cn";
import { collapsibleHeightMotionClass } from "#app/shared/lib/ui/interaction-chrome";

import type { SidebarPaneGeometryInput } from "./sidebar-pane-geometry";
import { SidebarSectionRowResizeHandle, SidebarViewSection } from "./SidebarViewSection";
import { useSidebarPaneStack } from "./use-sidebar-pane-stack";

const noop = () => {};

export type SidebarPaneStackItem = SidebarPaneGeometryInput & {
  title: string;
  ariaLabel: string;
  panelId: string;
  body: ReactNode;
  onToggleExpanded: () => void;
};

export type SidebarPaneStackProps = {
  panes: SidebarPaneStackItem[];
  className?: string;
};

export function SidebarPaneStack({ panes, className }: SidebarPaneStackProps) {
  const {
    stackRef,
    displayHeights,
    motionEnabled,
    canToggle,
    showResizeHandles,
    resizeHandles,
    getResizeHandleProps,
  } = useSidebarPaneStack({
    panes,
  });
  const paneTitleMap = useMemo(
    () => Object.fromEntries(panes.map((pane) => [pane.id, pane.title])),
    [panes],
  );
  const bodyClassName = motionEnabled ? collapsibleHeightMotionClass : undefined;

  return (
    <div ref={stackRef} className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)}>
      {panes.map((pane) => {
        const resizeHandle = showResizeHandles
          ? resizeHandles.find((handle) => handle.anchorPaneId === pane.id)
          : undefined;
        const resizeHandleProps = resizeHandle ? getResizeHandleProps(resizeHandle.id) : null;

        return (
          <Fragment key={pane.id}>
            {resizeHandle && resizeHandleProps ? (
              <SidebarSectionRowResizeHandle
                active={resizeHandleProps.active}
                ariaLabel={`调整${paneTitleMap[resizeHandle.upperPaneId]}与${pane.title}区域高度`}
                onPointerDown={resizeHandleProps.onPointerDown}
              />
            ) : null}
            <SidebarViewSection
              ariaLabel={pane.ariaLabel}
              bodyClassName={bodyClassName}
              bodyHeight={displayHeights[pane.id] ?? 0}
              expanded={pane.expanded}
              panelId={pane.panelId}
              title={pane.title}
              onToggleExpanded={canToggle ? pane.onToggleExpanded : noop}
            >
              {pane.body}
            </SidebarViewSection>
          </Fragment>
        );
      })}
    </div>
  );
}
