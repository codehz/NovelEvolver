import type { ReactNode } from "react";

import type { ActivityViewId } from "@/components/workbench";
import { AuxiliaryPanelDemo } from "./auxiliary-demo";
import { EditorArea } from "./EditorArea";
import { ExplorerSidebarDemo, ScmSidebarDemo, SearchSidebarDemo } from "./primary-sidebar-demo";
import { StatusBar } from "./StatusBar";

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
    editor: <EditorArea />,
    auxiliary: <AuxiliaryPanelDemo />,
    statusBar: <StatusBar />,
  };
}
