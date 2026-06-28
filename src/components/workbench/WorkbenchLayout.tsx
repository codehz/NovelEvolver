import { useState, type ReactNode } from "react";

import { ActivityBar } from "./ActivityBar";
import { AuxiliarySidebar } from "./AuxiliarySidebar";
import { PrimarySidebar } from "./PrimarySidebar";
import { TitleBarAuxiliaryToggle } from "./TitleBarAuxiliaryToggle";
import { TitleBarPrimarySidebarToggle } from "./TitleBarPrimarySidebarToggle";
import type { ActivityViewId } from "./types";

export type WorkbenchLayoutProps = {
  primarySidebar: Partial<Record<ActivityViewId, ReactNode>>;
  editor: ReactNode;
  auxiliary?: ReactNode;
  statusBar?: ReactNode;
};

export function WorkbenchLayout({
  primarySidebar,
  editor,
  auxiliary,
  statusBar,
}: WorkbenchLayoutProps) {
  const [activeView, setActiveView] = useState<ActivityViewId>("explorer");
  const [primarySidebarVisible, setPrimarySidebarVisible] = useState(true);
  const [auxiliaryVisible, setAuxiliaryVisible] = useState(true);

  function handleSelectView(view: ActivityViewId) {
    if (view === activeView && primarySidebarVisible) {
      setPrimarySidebarVisible(false);
      return;
    }
    setActiveView(view);
    setPrimarySidebarVisible(true);
  }

  const primaryContent = primarySidebar[activeView];

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <TitleBarPrimarySidebarToggle
        visible={primarySidebarVisible}
        onToggle={() => setPrimarySidebarVisible((value) => !value)}
      />
      <TitleBarAuxiliaryToggle
        visible={auxiliaryVisible}
        onToggle={() => setAuxiliaryVisible((value) => !value)}
      />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <ActivityBar
          activeView={activeView}
          primarySidebarVisible={primarySidebarVisible}
          onSelectView={handleSelectView}
        />
        {primarySidebarVisible ? (
          <PrimarySidebar activeView={activeView}>{primaryContent}</PrimarySidebar>
        ) : null}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{editor}</div>
        <AuxiliarySidebar visible={auxiliaryVisible}>{auxiliary}</AuxiliarySidebar>
      </div>
      {statusBar}
    </div>
  );
}