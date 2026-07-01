import { useCallback, useRef, useState } from "react";

import {
  SidebarSectionActionsPortalContent,
  SidebarHeaderActionButton,
} from "@/components/workbench";
import { notificationApi } from "@/lib/notifications";

import { useResourceLibrary } from "../demo/branch/branch-scopes";
import { useWorkbenchEditorActions } from "../demo/editor/use-workbench-editor-actions";
import { ResourceLibraryTree, type CreatingState } from "./ResourceLibraryTree";

export function ResourceLibrarySectionBody() {
  const resources = useResourceLibrary();
  const { openResourceTab } = useWorkbenchEditorActions();
  const [treeRevision, setTreeRevision] = useState(0);
  const [creating, setCreating] = useState<CreatingState | null>(null);
  const creatingIdRef = useRef(0);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const selectedTypeRef = useRef<"file" | "folder" | null>(null);
  const [expandPath, setExpandPath] = useState<string | null>(null);

  const bumpTree = useCallback(() => {
    setTreeRevision((value) => value + 1);
  }, []);

  const handleSelect = useCallback((path: string, type: "file" | "folder") => {
    setSelectedPath(path);
    selectedTypeRef.current = type;
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

  const startCreating = useCallback(
    (kind: "file" | "folder") => {
      let parentPath = "";
      if (selectedPath !== null) {
        if (selectedTypeRef.current === "folder") {
          parentPath = selectedPath;
          setExpandPath(selectedPath);
        } else {
          const lastSlash = selectedPath.lastIndexOf("/");
          parentPath = lastSlash >= 0 ? selectedPath.slice(0, lastSlash) : "";
        }
      }
      creatingIdRef.current += 1;
      setCreating({ id: creatingIdRef.current, kind, parentPath });
    },
    [selectedPath],
  );

  const cancelCreating = useCallback(() => {
    setCreating(null);
  }, []);

  const confirmCreating = useCallback(
    async (kind: "file" | "folder", name: string) => {
      setCreating(null);
      const path = name.trim();
      if (path === "") {
        return;
      }
      try {
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
          onClick={() => startCreating("file")}
        />
        <SidebarHeaderActionButton
          label="新建文件夹"
          icon="icon-[codicon--new-folder]"
          onClick={() => startCreating("folder")}
        />
      </SidebarSectionActionsPortalContent>
      <ResourceLibraryTree
        key={treeRevision}
        listDirectory={listDirectory}
        onOpenFile={onOpenFile}
        creating={creating}
        onCreateConfirm={(kind, name) => void confirmCreating(kind, name)}
        onCreateCancel={cancelCreating}
        selectedPath={selectedPath}
        onSelect={handleSelect}
        expandPath={expandPath}
      />
    </>
  );
}
