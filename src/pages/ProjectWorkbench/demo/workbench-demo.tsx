import type { ReactNode } from "react";

import type { WorkbenchPrimaryView } from "#app/components/workbench";
import { cn } from "#app/lib/cn";

import { EditorArea } from "./editor/EditorArea";
import { AuxiliaryPanelDemo } from "./sidebars/auxiliary-demo";
import { ExplorerSidebarDemo, SearchSidebarDemo } from "./sidebars/primary-sidebar-demo";
import { ScmSidebarSection } from "./sidebars/ScmSidebarSection";

export function buildWorkbenchDemoSlots(projectLabel: string): {
  primaryViews: WorkbenchPrimaryView[];
  editor: ReactNode;
  auxiliary: ReactNode;
} {
  return {
    primaryViews: [
      {
        id: "explorer",
        title: "资源管理器",
        iconClass: cn("icon-[codicon--files]"),
        content: <ExplorerSidebarDemo projectLabel={projectLabel} />,
      },
      {
        id: "search",
        title: "搜索",
        iconClass: cn("icon-[codicon--search]"),
        content: <SearchSidebarDemo />,
      },
      {
        id: "scm",
        title: "源代码管理",
        iconClass: cn("icon-[codicon--source-control]"),
        content: <ScmSidebarSection />,
      },
    ],
    editor: <EditorArea />,
    auxiliary: <AuxiliaryPanelDemo />,
  };
}
