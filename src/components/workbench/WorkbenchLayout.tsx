import { useState } from "react";

import { ActivityBar } from "./ActivityBar";
import { AuxiliarySidebar } from "./AuxiliarySidebar";
import { EditorArea } from "./EditorArea";
import { PrimarySidebar } from "./PrimarySidebar";
import { StatusBar } from "./StatusBar";
import { TitleBarAuxiliaryToggle } from "./TitleBarAuxiliaryToggle";
import type { ActivityViewId } from "./types";

export function WorkbenchLayout({ projectLabel }: { projectLabel: string }) {
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

  const tabs = [
    { id: "chapter-1", label: "第一章.md", active: true },
    { id: "outline", label: "大纲.md", active: false },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
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
          <PrimarySidebar activeView={activeView} projectLabel={projectLabel} />
        ) : null}
        <EditorArea tabs={tabs} />
        <AuxiliarySidebar visible={auxiliaryVisible} />
      </div>
      <StatusBar />
    </div>
  );
}