import { useMolecule } from "bunshi/react";
import { useSetAtom, useStore } from "jotai";
import { useCallback, useRef } from "react";

import { notificationApi } from "#app/lib/notifications";
import {
  expandDirsAfterCreate,
  joinResourceChildPath,
  normalizeResourceNameInput,
} from "#shared/resource-library-path";

import { useResourceLibrary } from "../../demo/branch/branch-scopes";
import { useWorkbenchEditorActions } from "../../demo/editor/use-workbench-editor-actions";
import { resourceLibraryTreeMolecule } from "./resource-tree-molecule";
import { parentPathForCreating } from "./tree-ui-reducer";

export function useResourceLibraryTreeActions() {
  const resources = useResourceLibrary();
  const { openResourceTab } = useWorkbenchEditorActions();
  const { treeDataAtom, treeUiAtom } = useMolecule(resourceLibraryTreeMolecule);
  const store = useStore();
  const dispatchData = useSetAtom(treeDataAtom);
  const dispatchUi = useSetAtom(treeUiAtom);
  const creatingIdRef = useRef(0);

  const startCreating = useCallback(
    (kind: "file" | "folder") => {
      const ui = store.get(treeUiAtom);
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
    [dispatchUi, store],
  );

  const cancelCreating = useCallback(() => {
    dispatchUi({ type: "cancelCreating" });
  }, [dispatchUi]);

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

  const startRenaming = useCallback(() => {
    const ui = store.get(treeUiAtom);
    if (ui.selected === null || ui.creating !== null || ui.renaming !== null) {
      return;
    }
    dispatchUi({
      type: "startRenaming",
      renaming: {
        path: ui.selected.path,
        kind: ui.selected.type,
      },
    });
  }, [dispatchUi, store]);

  const cancelRenaming = useCallback(() => {
    dispatchUi({ type: "cancelRenaming" });
  }, [dispatchUi]);

  const confirmRenaming = useCallback(
    async (oldPath: string, kind: "file" | "folder", name: string) => {
      dispatchUi({ type: "cancelRenaming" });
      const normalized = normalizeResourceNameInput(name);
      if (normalized === "") {
        return;
      }
      const lastSlash = oldPath.lastIndexOf("/");
      const parentPath = lastSlash >= 0 ? oldPath.slice(0, lastSlash) : "";
      let newPath: string;
      try {
        newPath = joinResourceChildPath(parentPath, normalized);
      } catch (error) {
        notificationApi.error(error instanceof Error ? error.message : "路径无效", {
          source: "资源库",
        });
        return;
      }
      if (newPath === "" || newPath === oldPath) {
        return;
      }
      try {
        await resources.move(oldPath, newPath);
        dispatchData({ type: "invalidatePath", path: parentPath });
        dispatchUi({ type: "select", path: newPath, nodeType: kind });
      } catch (error) {
        notificationApi.error(error instanceof Error ? error.message : "重命名失败", {
          source: "资源库",
        });
      }
    },
    [dispatchData, dispatchUi, resources],
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
    startCreating,
    cancelCreating,
    confirmCreating,
    startRenaming,
    cancelRenaming,
    confirmRenaming,
    activateNode,
  };
}
