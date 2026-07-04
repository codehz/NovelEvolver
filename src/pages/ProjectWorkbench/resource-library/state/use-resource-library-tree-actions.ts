import { useMolecule } from "bunshi/react";
import { useSetAtom, useStore } from "jotai";
import { useCallback, useRef } from "react";

import { notificationApi } from "#app/lib/notifications";
import {
  expandDirsAfterCreate,
  joinResourceChildPath,
  normalizeResourceNameInput,
  resourceBaseName,
  resourceParentPath,
} from "#shared/resource-library-path";

import { useResourceLibrary } from "../../demo/branch/branch-scopes";
import { useWorkbenchEditorActions } from "../../demo/editor/use-workbench-editor-actions";
import { resourceLibraryTreeMolecule } from "./resource-tree-molecule";
import { moveDestinationPath } from "./tree-data-reducer";
import type { ResourceTreeEditingState, ResourceTreeSelection } from "./types";

function parentPathForCreating(selected: ResourceTreeSelection | null): string {
  if (selected === null) {
    return "";
  }
  if (selected.type === "folder") {
    return selected.path;
  }
  return resourceParentPath(selected.path);
}

export function useResourceLibraryTreeActions() {
  const resources = useResourceLibrary();
  const { openResourceTab, rebindResourcePaths, closeResourceTabs } = useWorkbenchEditorActions();
  const { treeAtom } = useMolecule(resourceLibraryTreeMolecule);
  const store = useStore();
  const dispatch = useSetAtom(treeAtom);
  const creatingIdRef = useRef(0);

  const startCreating = useCallback(
    (kind: "file" | "folder") => {
      const current = store.get(treeAtom);
      const parentPath = parentPathForCreating(current.selected);
      creatingIdRef.current += 1;
      dispatch({
        type: "startEditing",
        editing: {
          mode: "creating",
          id: creatingIdRef.current,
          kind,
          parentPath,
        },
      });
    },
    [dispatch, store, treeAtom],
  );

  const startRenaming = useCallback(() => {
    const current = store.get(treeAtom);
    if (current.selected === null || current.editing !== null || current.selected.path === "") {
      return;
    }
    dispatch({
      type: "startEditing",
      editing: {
        mode: "renaming",
        path: current.selected.path,
        kind: current.selected.type,
      },
    });
  }, [dispatch, store, treeAtom]);

  const cancelEditing = useCallback(() => {
    dispatch({ type: "cancelEditing" });
  }, [dispatch]);

  const submitCreating = useCallback(
    async (editing: Extract<ResourceTreeEditingState, { mode: "creating" }>, name: string) => {
      dispatch({ type: "cancelEditing" });
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
        const snapshot =
          editing.kind === "folder"
            ? await resources.createFolder(path)
            : await resources.createFile(path);
        dispatch({ type: "setSnapshot", snapshot });
        dispatch({ type: "expandPaths", paths: expandDirsAfterCreate(path, editing.kind) });
        dispatch({ type: "select", path, nodeType: editing.kind });
        if (editing.kind === "file") {
          void openResourceTab(path, (resourcePath) => resources.readFile(resourcePath));
        }
      } catch (error) {
        notificationApi.error(error instanceof Error ? error.message : "创建失败", {
          source: "资源库",
        });
      }
    },
    [dispatch, openResourceTab, resources],
  );

  const submitRenaming = useCallback(
    async (editing: Extract<ResourceTreeEditingState, { mode: "renaming" }>, name: string) => {
      dispatch({ type: "cancelEditing" });
      const normalized = normalizeResourceNameInput(name);
      if (normalized === "") {
        return;
      }
      const parentPath = resourceParentPath(editing.path);
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
        const snapshot = await resources.move(editing.path, newPath);
        rebindResourcePaths(editing.path, newPath, editing.kind);
        dispatch({ type: "remapPaths", from: editing.path, to: newPath, nodeType: editing.kind });
        dispatch({ type: "setSnapshot", snapshot });
        dispatch({ type: "select", path: newPath, nodeType: editing.kind });
      } catch (error) {
        notificationApi.error(error instanceof Error ? error.message : "重命名失败", {
          source: "资源库",
        });
      }
    },
    [dispatch, rebindResourcePaths, resources],
  );

  const moveNode = useCallback(
    async (sourcePath: string, sourceType: "file" | "folder", targetPath: string) => {
      const newPath = moveDestinationPath(sourcePath, targetPath);
      if (newPath === "" || newPath === sourcePath) {
        return;
      }

      try {
        const snapshot = await resources.move(sourcePath, newPath);
        rebindResourcePaths(sourcePath, newPath, sourceType);
        if (targetPath !== "") {
          dispatch({ type: "expandPath", path: targetPath });
        }
        dispatch({ type: "remapPaths", from: sourcePath, to: newPath, nodeType: sourceType });
        dispatch({ type: "setSnapshot", snapshot });
        dispatch({ type: "select", path: newPath, nodeType: sourceType });
      } catch (error) {
        notificationApi.error(error instanceof Error ? error.message : "移动失败", {
          source: "资源库",
        });
      }
    },
    [dispatch, rebindResourcePaths, resources],
  );

  const activateNode = useCallback(
    (path: string, type: "file" | "folder") => {
      dispatch({ type: "select", path, nodeType: type });
      if (type === "folder") {
        dispatch({ type: "toggleFolder", path });
        return;
      }
      void openResourceTab(path, (resourcePath) => resources.readFile(resourcePath));
    },
    [dispatch, openResourceTab, resources],
  );

  const deleteNode = useCallback(async () => {
    const current = store.get(treeAtom);
    if (current.selected === null || current.selected.path === "") {
      return;
    }
    const { path, type } = current.selected;
    const name = resourceBaseName(path);
    if (!confirm(`确定要删除「${name}」吗？`)) {
      return;
    }

    try {
      const snapshot = await resources.unlink(path);
      closeResourceTabs(path, type);
      dispatch({ type: "setSnapshot", snapshot });
    } catch (error) {
      notificationApi.error(error instanceof Error ? error.message : "删除失败", {
        source: "资源库",
      });
    }
  }, [closeResourceTabs, dispatch, resources, store, treeAtom]);

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
    deleteNode,
    moveNode,
  };
}
