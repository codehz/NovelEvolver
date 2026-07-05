import { Fragment, useMemo, type ReactNode } from "react";

import { cn } from "#app/lib/cn";

import { SidebarSectionRowResizeHandle, SidebarViewSection } from "./SidebarViewSection";
import { useSidebarPaneStack, type SidebarPaneStackPane } from "./use-sidebar-pane-stack";

export type SidebarPaneStackItem = SidebarPaneStackPane & {
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
  const { stackRef, paneLayouts, resizeHandles, getResizeHandleProps } = useSidebarPaneStack({
    panes,
  });
  const paneTitleMap = useMemo(
    () => Object.fromEntries(panes.map((pane) => [pane.id, pane.title])),
    [panes],
  );

  return (
    <div
      ref={stackRef}
      className={cn("-m-2 flex min-h-0 flex-1 flex-col overflow-hidden", className)}
    >
      {panes.map((pane) => {
        const layout = paneLayouts[pane.id];
        const resizeHandle = resizeHandles.find((handle) => handle.anchorPaneId === pane.id);
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
              bodyFillsSection={layout?.bodyFillsSection}
              bodyStyle={layout?.bodyStyle}
              expanded={pane.expanded}
              panelId={pane.panelId}
              sectionStyle={layout?.sectionStyle}
              title={pane.title}
              onToggleExpanded={pane.onToggleExpanded}
            >
              {pane.body}
            </SidebarViewSection>
          </Fragment>
        );
      })}
    </div>
  );
}
