import { useMolecule } from "bunshi/react";
import { useSetAtom, useStore } from "jotai";
import { useCallback, useRef } from "react";

import { notificationApi } from "#app/shared/lib/notifications";
import { normalizeResourceNameInput } from "#shared/resource-library-path";
import type { ResourceTreeSnapshot } from "#shared/rpc/worktree/index";

import { useResourceLibrary } from "../../../branch/branch-scopes";
import { useWorkbenchEditorActions } from "../../../editor/use-workbench-editor-actions";
import { findResourceParentId } from "../resource-tree";
import { resourceLibraryTreeMolecule } from "./resource-tree-molecule";
import type { ResourceTreeEditingState, ResourceTreeSelection } from "./types";

function parentIdForCreating(
  selected: ResourceTreeSelection | null,
  snapshot: ResourceTreeSnapshot,
): string {
  if (selected === null) {
    return snapshot.rootId;
  }
  if (selected.type === "folder") {
    return selected.id;
  }
  return findResourceParentId(snapshot, selected.id) ?? snapshot.rootId;
}

export function useResourceLibraryTreeActions() {
  const resources = useResourceLibrary();
  const { focusTarget, openTarget } = useWorkbenchEditorActions();
  const { treeAtom } = useMolecule(resourceLibraryTreeMolecule);
  const store = useStore();
  const dispatch = useSetAtom(treeAtom);
  const creatingIdRef = useRef(0);

  const startCreating = useCallback(
    (kind: "file" | "folder") => {
      const current = store.get(treeAtom);
      const parentId =
        current.snapshot === null
          ? "root"
          : parentIdForCreating(current.selected, current.snapshot);
      creatingIdRef.current += 1;
      dispatch({
        type: "startEditing",
        editing: {
          mode: "creating",
          id: creatingIdRef.current,
          kind,
          parentId,
        },
      });
    },
    [dispatch, store, treeAtom],
  );

  const startRenaming = useCallback(() => {
    const current = store.get(treeAtom);
    if (current.selected === null || current.editing !== null) {
      return;
    }
    if (current.snapshot?.rootId === current.selected.id) {
      return;
    }
    dispatch({
      type: "startEditing",
      editing: {
        mode: "renaming",
        id: current.selected.id,
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
      const normalized = normalizeResourceNameInput(name);
      if (normalized === "") {
        return;
      }
      try {
        const result =
          editing.kind === "folder"
            ? await resources.createFolder(editing.parentId, normalized)
            : await resources.createFile(editing.parentId, normalized);
        dispatch({ type: "expandPath", id: editing.parentId });
        dispatch({ type: "select", id: result.nodeId, nodeType: editing.kind });
        if (editing.kind === "file") {
          openTarget({ kind: "resource", resourceId: result.nodeId });
        }
      } catch (error) {
        notificationApi.error(error instanceof Error ? error.message : "创建失败", {
          source: "资源库",
        });
      }
    },
    [dispatch, openTarget, resources],
  );

  const submitRenaming = useCallback(
    async (editing: Extract<ResourceTreeEditingState, { mode: "renaming" }>, name: string) => {
      dispatch({ type: "cancelEditing" });
      const normalized = normalizeResourceNameInput(name);
      if (normalized === "") {
        return;
      }

      try {
        await resources.renameNode(editing.id, normalized);
      } catch (error) {
        notificationApi.error(error instanceof Error ? error.message : "重命名失败", {
          source: "资源库",
        });
      }
    },
    [dispatch, resources],
  );

  const moveNode = useCallback(
    async (sourceId: string, sourceType: "file" | "folder", targetParentId: string) => {
      if (sourceId === targetParentId) {
        return;
      }

      try {
        await resources.moveNode(sourceId, targetParentId);
        if (sourceType === "folder") {
          dispatch({ type: "expandPath", id: targetParentId });
        }
        dispatch({ type: "select", id: sourceId, nodeType: sourceType });
      } catch (error) {
        notificationApi.error(error instanceof Error ? error.message : "移动失败", {
          source: "资源库",
        });
      }
    },
    [dispatch, resources],
  );

  const selectNode = useCallback(
    (id: string, type: "file" | "folder") => {
      dispatch({ type: "select", id, nodeType: type });
    },
    [dispatch],
  );

  const activateNode = useCallback(
    (id: string, type: "file" | "folder", _name: string, intent: "focus" | "open") => {
      selectNode(id, type);
      if (type === "folder") {
        dispatch({ type: "toggleFolder", id });
        return;
      }
      const target = { kind: "resource" as const, resourceId: id };
      if (intent === "focus") {
        focusTarget(target);
        return;
      }
      openTarget(target);
    },
    [dispatch, focusTarget, openTarget, selectNode],
  );

  const deleteNode = useCallback(async () => {
    const current = store.get(treeAtom);
    if (current.selected === null || current.snapshot === null) {
      return;
    }
    const node = current.snapshot.nodes[current.selected.id];
    if (node === undefined || current.selected.id === current.snapshot.rootId) {
      return;
    }
    if (!confirm(`确定要删除「${node.name}」吗？`)) {
      return;
    }

    try {
      await resources.deleteNode(node.id);
      const parentId = findResourceParentId(current.snapshot, node.id);
      if (parentId !== null) {
        dispatch({ type: "select", id: parentId, nodeType: "folder" });
      }
    } catch (error) {
      notificationApi.error(error instanceof Error ? error.message : "删除失败", {
        source: "资源库",
      });
    }
  }, [dispatch, resources, store, treeAtom]);

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
    selectNode,
    activateNode,
    deleteNode,
    moveNode,
  };
}
