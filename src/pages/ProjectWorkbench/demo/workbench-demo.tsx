import type { ReactNode } from "react";

import type { ProjectHandle } from "@shared/rpc/projects-rpc";
import type { RpcStub } from "capnweb";
import type { ActivityViewId } from "@/components/workbench";
import { AuxiliaryPanelDemo } from "./auxiliary-demo";
import { EditorArea } from "./EditorArea";
import { ExplorerSidebarDemo, ScmSidebarDemo, SearchSidebarDemo } from "./primary-sidebar-demo";
import { StatusBar } from "./StatusBar";

export function buildWorkbenchDemoSlots(
  projectLabel: string,
  project: RpcStub<ProjectHandle>,
): {
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
    statusBar: <StatusBar project={project} />,
  };
}
