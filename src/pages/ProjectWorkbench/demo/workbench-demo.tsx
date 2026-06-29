import type { ReactNode } from "react";

import type { ActivityViewId } from "../../../components/workbench";
import { AuxiliaryPanelDemo } from "./auxiliary-demo";
import { EditorArea } from "./EditorArea";
import { ExplorerSidebarDemo, ScmSidebarDemo, SearchSidebarDemo } from "./primary-sidebar-demo";
import { StatusBar } from "./StatusBar";

const demoTabs = [
  { id: "chapter-1", label: "第一章.md", active: true },
  { id: "outline", label: "大纲.md", active: false },
];

export function buildWorkbenchDemoSlots(projectLabel: string): {
  primarySidebar: Partial<Record<ActivityViewId, ReactNode>>;
  editor: ReactNode;
  auxiliary: ReactNode;
  statusBar: ReactNode;
} {
  return {
    primarySidebar: {
      explorer: <ExplorerSidebarDemo projectLabel={projectLabel} />,
      search: <SearchSidebarDemo />,
      scm: <ScmSidebarDemo />,
    },
    editor: <EditorArea tabs={demoTabs} />,
    auxiliary: <AuxiliaryPanelDemo />,
    statusBar: <StatusBar />,
  };
}
