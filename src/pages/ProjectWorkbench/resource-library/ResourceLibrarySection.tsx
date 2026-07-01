import {
  SidebarSectionActionsPortalContent,
  SidebarHeaderActionButton,
} from "@/components/workbench";

import { ResourceLibraryTree } from "./ResourceLibraryTree";
import { useResourceLibraryTreeActions } from "./state/use-resource-library-tree-actions";
import { useResourceTreeSync } from "./state/use-resource-tree-sync";

export function ResourceLibrarySectionBody() {
  useResourceTreeSync();
  const { startCreating } = useResourceLibraryTreeActions();

  return (
    <>
      <SidebarSectionActionsPortalContent>
        <SidebarHeaderActionButton
          label="新建文件"
          icon="icon-[codicon--new-file]"
          onClick={() => startCreating("file")}
        />
        <SidebarHeaderActionButton
          label="新建文件夹"
          icon="icon-[codicon--new-folder]"
          onClick={() => startCreating("folder")}
        />
      </SidebarSectionActionsPortalContent>
      <ResourceLibraryTree />
    </>
  );
}
