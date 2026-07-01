import type { ReactNode } from "react";

import type { ActivityViewId } from "#app/components/workbench";

import { EditorArea } from "./editor/EditorArea";
import { AuxiliaryPanelDemo } from "./sidebars/auxiliary-demo";
import {
  ExplorerSidebarDemo,
  ScmSidebarDemo,
  SearchSidebarDemo,
} from "./sidebars/primary-sidebar-demo";
export function buildWorkbenchDemoSlots(projectLabel: string): {
  primarySidebar: Partial<Record<ActivityViewId, ReactNode>>;
  editor: ReactNode;
  auxiliary: ReactNode;
} {
  return {
    primarySidebar: {
      explorer: <ExplorerSidebarDemo projectLabel={projectLabel} />,
      search: <SearchSidebarDemo />,
      scm: <ScmSidebarDemo />,
    },
    editor: <EditorArea />,
    auxiliary: <AuxiliaryPanelDemo />,
  };
}
