import { useCallback, useMemo, type ReactNode } from "react";

import { TitleBarAuxiliaryToggle } from "../titlebar/TitleBarAuxiliaryToggle";
import { TitleBarPrimarySidebarToggle } from "../titlebar/TitleBarPrimarySidebarToggle";
import type { WorkbenchPrimaryView } from "../types";
import { WorkbenchActivityBar } from "./activity/WorkbenchActivityBar";
import { PrimarySidebarViewStack } from "./dock/PrimarySidebarViewStack";
import { SidebarDock } from "./dock/SidebarDock";
import { SidebarFrame } from "./dock/SidebarFrame";
import { useMeasuredElementWidth } from "./hooks/use-measured-element-width";
import { useWorkbenchActiveView } from "./hooks/use-workbench-active-view";
import { useWorkbenchLayoutMotion } from "./hooks/use-workbench-layout-motion";
import { useWorkbenchLayoutPreferences } from "./hooks/use-workbench-layout-preferences";
import { useWorkbenchSidebarResize } from "./hooks/use-workbench-sidebar-resize";
import {
  ACTIVITY_BAR_WIDTH,
  DEFAULT_AUXILIARY_WIDTH,
  DEFAULT_PRIMARY_WIDTH,
  MIN_EDITOR_WIDTH,
  WORKBENCH_EDGE_INSET,
  deriveWorkbenchChromeLayout,
  sidebarChromeOuterSize,
} from "./resolve/workbench-layout-resolver";
import { WorkbenchChromeProvider } from "./workbench-chrome-context";

/** Fallback before the container is measured — must reserve both sidebar sashes. */
const INITIAL_WORKBENCH_WIDTH =
  ACTIVITY_BAR_WIDTH +
  sidebarChromeOuterSize(DEFAULT_PRIMARY_WIDTH) +
  sidebarChromeOuterSize(DEFAULT_AUXILIARY_WIDTH) +
  MIN_EDITOR_WIDTH +
  WORKBENCH_EDGE_INSET;

export type WorkbenchLayoutProps = {
  primaryViews: readonly WorkbenchPrimaryView[];
  editor: ReactNode;
  auxiliary: ReactNode;
  defaultActiveViewId?: string;
  projectSettingsOpen?: boolean;
  onOpenProjectSettings?: () => void;
};

export function WorkbenchLayout({
  primaryViews,
  editor,
  auxiliary,
  defaultActiveViewId,
  projectSettingsOpen = false,
  onOpenProjectSettings,
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
  const { ref: containerRef, width: containerWidth } =
    useMeasuredElementWidth<HTMLDivElement>(INITIAL_WORKBENCH_WIDTH);
  const chromeLayout = useMemo(
    () =>
      deriveWorkbenchChromeLayout({
        layoutPreferences,
        containerWidth,
      }),
    [containerWidth, layoutPreferences],
  );
  const { resolved: resolvedLayout, primary, auxiliary: auxiliaryChrome } = chromeLayout;
  const { activeResizeSide, startResizeDrag } = useWorkbenchSidebarResize({
    layoutPreferences,
    resolvedLayout,
    setLayoutPreferences,
  });
  const { displayed } = useWorkbenchLayoutMotion({
    chromeLayout,
    containerWidth,
    activeResizeSide,
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
  const chromeContext = useMemo(
    () => ({
      activePrimaryViewId: activeViewId,
      primaryVisible: primary.visible,
      auxiliaryVisible: auxiliaryChrome.visible,
    }),
    [activeViewId, auxiliaryChrome.visible, primary.visible],
  );

  return (
    <WorkbenchChromeProvider value={chromeContext}>
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
            projectSettingsOpen={projectSettingsOpen}
            onOpenProjectSettings={onOpenProjectSettings}
            onSelectView={handleActivitySelectView}
          />
          <SidebarDock
            opacity={displayed.primary.opacity}
            panelWidth={displayed.primary.panelWidth}
            resizeActive={activeResizeSide === "primary"}
            resizeAriaLabel="调整主侧边栏宽度"
            side="primary"
            spacerWidth={displayed.primary.spacerWidth}
            title={activePrimaryView.title}
            onResizePointerDown={(event) => {
              startResizeDrag("primary", event);
            }}
          >
            <PrimarySidebarViewStack activeViewId={activeViewId} views={primaryViews} />
          </SidebarDock>
          {/* Above sidebars (`z-0`) so collapse fade is covered by the expanding editor; below activity bar `z-30`. */}
          <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {editor}
          </div>
          <SidebarDock
            opacity={displayed.auxiliary.opacity}
            panelWidth={displayed.auxiliary.panelWidth}
            resizeActive={activeResizeSide === "auxiliary"}
            resizeAriaLabel="调整辅助侧边栏宽度"
            side="auxiliary"
            spacerWidth={displayed.auxiliary.spacerWidth}
            title="AI 助手"
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
    </WorkbenchChromeProvider>
  );
}
