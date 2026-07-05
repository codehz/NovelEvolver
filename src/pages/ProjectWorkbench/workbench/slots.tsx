import type { ReactNode } from "react";

import type { WorkbenchPrimaryView } from "#app/components/workbench";
import { cn } from "#app/lib/cn";

import { EditorArea } from "./editor/EditorArea";
import { SearchSidebarSection } from "./search/SearchSidebarSection";
import { AuxiliaryPanel } from "./sidebars/auxiliary-panel";
import { ExplorerSidebar } from "./sidebars/primary-sidebar";
import { ScmSidebarSection } from "./sidebars/ScmSidebarSection";

export function buildWorkbenchSlots(projectLabel: string): {
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
        content: <ExplorerSidebar projectLabel={projectLabel} />,
      },
      {
        id: "search",
        title: "搜索",
        iconClass: cn("icon-[codicon--search]"),
        content: <SearchSidebarSection />,
      },
      {
        id: "scm",
        title: "源代码管理",
        iconClass: cn("icon-[codicon--source-control]"),
        content: <ScmSidebarSection />,
      },
    ],
    editor: <EditorArea />,
    auxiliary: <AuxiliaryPanel />,
  };
}
