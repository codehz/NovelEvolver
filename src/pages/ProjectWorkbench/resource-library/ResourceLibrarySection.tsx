import { useCallback, useState } from "react";

import {
  SidebarSectionActionsPortalContent,
  SidebarHeaderActionButton,
} from "@/components/workbench";
import { notificationApi } from "@/lib/notifications";
import { isQuickPickDismissedError, quickPickApi } from "@/lib/quick-pick";

import { useResourceLibrary } from "../demo/branch/branch-scopes";
import { useWorkbenchEditorActions } from "../demo/editor/use-workbench-editor-actions";
import { ResourceLibraryTree } from "./ResourceLibraryTree";

export function ResourceLibrarySectionBody() {
  const resources = useResourceLibrary();
  const { openResourceTab } = useWorkbenchEditorActions();
  const [treeRevision, setTreeRevision] = useState(0);

  const bumpTree = useCallback(() => {
    setTreeRevision((value) => value + 1);
  }, []);

  const listDirectory = useCallback(
    async (path: string) => {
      return resources.ls(path);
    },
    [resources],
  );

  const onOpenFile = useCallback(
    (path: string) => {
      void openResourceTab(path, (p) => resources.readFile(p));
    },
    [openResourceTab, resources],
  );

  const createAtRoot = useCallback(
    async (kind: "file" | "folder") => {
      try {
        const name = await quickPickApi.showInput({
          title: kind === "file" ? "新建文件" : "新建文件夹",
          inputLabel: "相对路径",
          placeholder: kind === "file" ? "例如 设定/世界观.md" : "例如 设定",
          dismissAriaLabel: "关闭",
          validate: (value) => (value.trim() === "" ? "名称不能为空" : null),
        });
        const path = name.trim();
        if (kind === "folder") {
          await resources.createFolder(path);
        } else {
          await resources.writeFile(path, "");
        }
        bumpTree();
        if (kind === "file") {
          void openResourceTab(path, (p) => resources.readFile(p));
        }
      } catch (error) {
        if (isQuickPickDismissedError(error)) {
          return;
        }
        notificationApi.error(error instanceof Error ? error.message : "创建失败", {
          source: "资源库",
        });
      }
    },
    [bumpTree, openResourceTab, resources],
  );

  return (
    <>
      <SidebarSectionActionsPortalContent>
        <SidebarHeaderActionButton
          label="新建文件"
          icon="icon-[codicon--new-file]"
          onClick={() => void createAtRoot("file")}
        />
        <SidebarHeaderActionButton
          label="新建文件夹"
          icon="icon-[codicon--new-folder]"
          onClick={() => void createAtRoot("folder")}
        />
      </SidebarSectionActionsPortalContent>
      <ResourceLibraryTree
        key={treeRevision}
        listDirectory={listDirectory}
        onOpenFile={onOpenFile}
      />
    </>
  );
}
