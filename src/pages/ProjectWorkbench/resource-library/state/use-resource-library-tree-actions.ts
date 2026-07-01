import { useMolecule } from "bunshi/react";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useRef } from "react";

import { notificationApi } from "@/lib/notifications";

import { useResourceLibrary } from "../../demo/branch/branch-scopes";
import { useWorkbenchEditorActions } from "../../demo/editor/use-workbench-editor-actions";
import { resourceLibraryTreeMolecule } from "./resource-tree-molecule";
import { parentPathForCreating } from "./tree-ui-reducer";

function resourcePathDir(path: string): string {
  const index = path.lastIndexOf("/");
  return index >= 0 ? path.slice(0, index) : "";
}

export function useResourceLibraryTreeActions() {
  const resources = useResourceLibrary();
  const { openResourceTab } = useWorkbenchEditorActions();
  const { treeDataAtom, treeUiAtom } = useMolecule(resourceLibraryTreeMolecule);
  const ui = useAtomValue(treeUiAtom);
  const dispatchData = useSetAtom(treeDataAtom);
  const dispatchUi = useSetAtom(treeUiAtom);
  const creatingIdRef = useRef(0);

  const select = useCallback(
    (path: string, type: "file" | "folder") => {
      dispatchUi({ type: "select", path, nodeType: type });
    },
    [dispatchUi],
  );

  const startCreating = useCallback(
    (kind: "file" | "folder") => {
      const parentPath = parentPathForCreating(ui.selected);
      creatingIdRef.current += 1;
      dispatchUi({
        type: "startCreating",
        creating: {
          id: creatingIdRef.current,
          kind,
          parentPath,
        },
      });
      if (parentPath !== "" && ui.selected?.type === "folder") {
        dispatchUi({ type: "requestExpand", path: parentPath });
      }
    },
    [dispatchUi, ui.selected],
  );

  const cancelCreating = useCallback(() => {
    dispatchUi({ type: "cancelCreating" });
  }, [dispatchUi]);

  const toggleFolder = useCallback(
    (path: string) => {
      dispatchData({ type: "toggleFolder", path });
    },
    [dispatchData],
  );

  const confirmCreating = useCallback(
    async (kind: "file" | "folder", name: string) => {
      dispatchUi({ type: "cancelCreating" });
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
        const parent = resourcePathDir(path);
        dispatchData({ type: "invalidatePath", path: parent });
        if (parent !== "") {
          dispatchUi({ type: "requestExpand", path: parent });
        }
        if (kind === "file") {
          void openResourceTab(path, (p) => resources.readFile(p));
        }
      } catch (error) {
        notificationApi.error(error instanceof Error ? error.message : "创建失败", {
          source: "资源库",
        });
      }
    },
    [dispatchData, dispatchUi, openResourceTab, resources],
  );

  const onOpenFile = useCallback(
    (path: string) => {
      void openResourceTab(path, (p) => resources.readFile(p));
    },
    [openResourceTab, resources],
  );

  const activateNode = useCallback(
    (path: string, type: "file" | "folder") => {
      dispatchUi({ type: "select", path, nodeType: type });
      if (type === "folder") {
        dispatchData({ type: "toggleFolder", path });
        return;
      }
      void openResourceTab(path, (p) => resources.readFile(p));
    },
    [dispatchData, dispatchUi, openResourceTab, resources],
  );

  return {
    select,
    startCreating,
    cancelCreating,
    confirmCreating,
    toggleFolder,
    onOpenFile,
    activateNode,
  };
}
