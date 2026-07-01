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
import type { ResourceTreeEditingState } from "./types";

export function useResourceLibraryTreeActions() {
  const resources = useResourceLibrary();
  const { openResourceTab, rebindResourcePaths } = useWorkbenchEditorActions();
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
        type: "startEditing",
        editing: {
          mode: "creating",
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

  const submitCreating = useCallback(
    async (editing: Extract<ResourceTreeEditingState, { mode: "creating" }>, name: string) => {
      dispatchUi({ type: "cancelEditing" });
      let path: string;
      try {
        path = joinResourceChildPath(editing.parentPath, name);
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
        if (editing.kind === "folder") {
          await resources.createFolder(path);
        } else {
          await resources.writeFile(path, "");
        }
        dispatchData({ type: "queueReloadPath", path: editing.parentPath });
        dispatchUi({
          type: "enqueueExpandPaths",
          paths: expandDirsAfterCreate(path, editing.kind),
        });
        dispatchUi({ type: "select", path, nodeType: editing.kind });
        if (editing.kind === "file") {
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
    if (ui.selected === null || ui.editing !== null) {
      return;
    }
    dispatchUi({
      type: "startEditing",
      editing: {
        mode: "renaming",
        path: ui.selected.path,
        kind: ui.selected.type,
      },
    });
  }, [dispatchUi, store]);

  const cancelEditing = useCallback(() => {
    dispatchUi({ type: "cancelEditing" });
  }, [dispatchUi]);

  const submitRenaming = useCallback(
    async (editing: Extract<ResourceTreeEditingState, { mode: "renaming" }>, name: string) => {
      dispatchUi({ type: "cancelEditing" });
      const normalized = normalizeResourceNameInput(name);
      if (normalized === "") {
        return;
      }
      const lastSlash = editing.path.lastIndexOf("/");
      const parentPath = lastSlash >= 0 ? editing.path.slice(0, lastSlash) : "";
      let newPath: string;
      try {
        newPath = joinResourceChildPath(parentPath, normalized);
      } catch (error) {
        notificationApi.error(error instanceof Error ? error.message : "路径无效", {
          source: "资源库",
        });
        return;
      }
      if (newPath === "" || newPath === editing.path) {
        return;
      }
      try {
        await resources.move(editing.path, newPath);
        rebindResourcePaths(editing.path, newPath, editing.kind);
        dispatchData({
          type: "remapPaths",
          from: editing.path,
          to: newPath,
          nodeType: editing.kind,
        });
        dispatchUi({ type: "remapPaths", from: editing.path, to: newPath, nodeType: editing.kind });
        dispatchData({ type: "queueReloadPath", path: parentPath });
        dispatchUi({ type: "select", path: newPath, nodeType: editing.kind });
      } catch (error) {
        notificationApi.error(error instanceof Error ? error.message : "重命名失败", {
          source: "资源库",
        });
      }
    },
    [dispatchData, dispatchUi, rebindResourcePaths, resources],
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

  const submitEditing = useCallback(
    async (editing: ResourceTreeEditingState, name: string) => {
      if (editing.mode === "creating") {
        await submitCreating(editing, name);
        return;
      }
      await submitRenaming(editing, name);
    },
    [submitCreating, submitRenaming],
  );

  return {
    startCreating,
    startRenaming,
    cancelEditing,
    submitEditing,
    activateNode,
  };
}
