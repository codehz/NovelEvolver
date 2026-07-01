import { expandDirsAfterCreate, joinResourceChildPath } from "@shared/resource-library-path";
import { useMolecule } from "bunshi/react";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useRef } from "react";

import { notificationApi } from "@/lib/notifications";

import { useResourceLibrary } from "../../demo/branch/branch-scopes";
import { useWorkbenchEditorActions } from "../../demo/editor/use-workbench-editor-actions";
import { resourceLibraryTreeMolecule } from "./resource-tree-molecule";
import { parentPathForCreating } from "./tree-ui-reducer";

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
    async (kind: "file" | "folder", parentPath: string, name: string) => {
      dispatchUi({ type: "cancelCreating" });
      let path: string;
      try {
        path = joinResourceChildPath(parentPath, name);
      } catch (error) {
        notificationApi.error(error instanceof Error ? error.message : "路径无效", {
          source: "资源库",
        });
        return;
      }
      if (path === "") {
        return;
      }
      try {
        if (kind === "folder") {
          await resources.createFolder(path);
        } else {
          await resources.writeFile(path, "");
        }
        dispatchData({ type: "invalidatePath", path: parentPath });
        dispatchUi({
          type: "enqueueExpandPaths",
          paths: expandDirsAfterCreate(path, kind),
        });
        dispatchUi({ type: "select", path, nodeType: kind });
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
