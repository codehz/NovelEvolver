import { useState } from "react";

import { ActivityBar } from "./ActivityBar";
import { AuxiliarySidebar } from "./AuxiliarySidebar";
import { EditorArea } from "./EditorArea";
import { PrimarySidebar } from "./PrimarySidebar";
import type { ActivityViewId } from "./types";

export function WorkbenchLayout({ projectLabel }: { projectLabel: string }) {
  const [activeView, setActiveView] = useState<ActivityViewId>("explorer");
  const [auxiliaryVisible, setAuxiliaryVisible] = useState(true);

  const tabs = [
    { id: "chapter-1", label: "第一章.md", active: true },
    { id: "outline", label: "大纲.md", active: false },
  ];

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <ActivityBar
        activeView={activeView}
        auxiliaryVisible={auxiliaryVisible}
        onSelectView={setActiveView}
        onToggleAuxiliary={() => setAuxiliaryVisible((value) => !value)}
      />
      <PrimarySidebar activeView={activeView} projectLabel={projectLabel} />
      <EditorArea tabs={tabs} />
      <AuxiliarySidebar visible={auxiliaryVisible} />
    </div>
  );
}