import { useCallback, useMemo, type ReactNode } from "react";

import { TitleBarAuxiliaryToggle } from "../titlebar/TitleBarAuxiliaryToggle";
import { TitleBarPrimarySidebarToggle } from "../titlebar/TitleBarPrimarySidebarToggle";
import type { WorkbenchPrimaryView } from "../types";
import { PrimarySidebarViewStack } from "./PrimarySidebarViewStack";
import { SidebarDock } from "./SidebarDock";
import { SidebarFrame } from "./SidebarFrame";
import { useMeasuredElementWidth } from "./use-measured-element-width";
import { useWorkbenchActiveView } from "./use-workbench-active-view";
import { useWorkbenchLayoutPreferences } from "./use-workbench-layout-preferences";
import { useWorkbenchSidebarResize } from "./use-workbench-sidebar-resize";
import {
  ACTIVITY_BAR_WIDTH,
  DEFAULT_AUXILIARY_WIDTH,
  DEFAULT_PRIMARY_WIDTH,
  MIN_EDITOR_WIDTH,
  WORKBENCH_EDGE_INSET,
  deriveWorkbenchChromeLayout,
} from "./workbench-layout-resolver";
import { WorkbenchActivityBar } from "./WorkbenchActivityBar";

export type WorkbenchLayoutProps = {
  primaryViews: readonly WorkbenchPrimaryView[];
  editor: ReactNode;
  auxiliary: ReactNode;
  defaultActiveViewId?: string;
};

export function WorkbenchLayout({
  primaryViews,
  editor,
  auxiliary,
  defaultActiveViewId,
}: WorkbenchLayoutProps) {
  if (primaryViews.length === 0) {
    throw new Error("WorkbenchLayout requires at least one primary view");
  }

  const { layoutPreferences, setLayoutPreferences, togglePrimarySidebar, toggleAuxiliarySidebar } =
    useWorkbenchLayoutPreferences();
  const { activePrimaryView, activeViewId, handleSelectView } = useWorkbenchActiveView({
    defaultActiveViewId,
    primaryViews,
    setLayoutPreferences,
  });
  const { ref: containerRef, width: containerWidth } = useMeasuredElementWidth<HTMLDivElement>(
    ACTIVITY_BAR_WIDTH +
      DEFAULT_PRIMARY_WIDTH +
      DEFAULT_AUXILIARY_WIDTH +
      MIN_EDITOR_WIDTH +
      WORKBENCH_EDGE_INSET,
  );
  const {
    resolved: resolvedLayout,
    primary,
    auxiliary: auxiliaryChrome,
  } = useMemo(
    () =>
      deriveWorkbenchChromeLayout({
        layoutPreferences,
        containerWidth,
      }),
    [containerWidth, layoutPreferences],
  );
  const { activeResizeSide, startResizeDrag } = useWorkbenchSidebarResize({
    layoutPreferences,
    resolvedLayout,
    setLayoutPreferences,
  });
  const activityItems = useMemo(
    () =>
      primaryViews.map((view) => ({
        id: view.id,
        label: view.title,
        iconClass: view.iconClass,
      })),
    [primaryViews],
  );
  const handleActivitySelectView = useCallback(
    (viewId: string) => {
      handleSelectView(viewId, primary.visible);
    },
    [handleSelectView, primary.visible],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <TitleBarPrimarySidebarToggle
        visible={primary.visible}
        onToggle={() => {
          togglePrimarySidebar(primary.visible);
        }}
      />
      <TitleBarAuxiliaryToggle
        visible={auxiliaryChrome.visible}
        onToggle={() => {
          toggleAuxiliarySidebar(auxiliaryChrome.visible);
        }}
      />
      <div ref={containerRef} className="flex min-h-0 flex-1 overflow-hidden">
        <WorkbenchActivityBar
          items={activityItems}
          activeView={activeViewId}
          primarySidebarVisible={primary.visible}
          onSelectView={handleActivitySelectView}
        />
        <SidebarDock
          panelWidth={primary.panelWidth}
          resizeActive={activeResizeSide === "primary"}
          resizeAriaLabel="调整主侧边栏宽度"
          resizeTransitionDisabled={activeResizeSide === "primary"}
          side="primary"
          spacerWidth={primary.spacerWidth}
          title={activePrimaryView.title}
          visible={primary.visible}
          onResizePointerDown={(event) => {
            startResizeDrag("primary", event);
          }}
        >
          <PrimarySidebarViewStack activeViewId={activeViewId} views={primaryViews} />
        </SidebarDock>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{editor}</div>
        <SidebarDock
          panelWidth={auxiliaryChrome.panelWidth}
          resizeActive={activeResizeSide === "auxiliary"}
          resizeAriaLabel="调整辅助侧边栏宽度"
          resizeTransitionDisabled={activeResizeSide === "auxiliary"}
          side="auxiliary"
          spacerWidth={auxiliaryChrome.spacerWidth}
          title="AI 助手"
          visible={auxiliaryChrome.visible}
          onResizePointerDown={(event) => {
            startResizeDrag("auxiliary", event);
          }}
        >
          <SidebarFrame
            aria-hidden={!auxiliaryChrome.visible}
            className="h-full min-h-0"
            title="AI 助手"
            titleMode="ghost"
          >
            {auxiliary}
          </SidebarFrame>
        </SidebarDock>
        {/* Always reserve right edge breath room — independent of auxiliary visibility. */}
        <div
          aria-hidden
          className="pointer-events-none h-full shrink-0"
          style={{ width: WORKBENCH_EDGE_INSET }}
        />
      </div>
    </div>
  );
}
