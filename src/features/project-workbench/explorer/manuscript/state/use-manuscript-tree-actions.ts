import { useMolecule } from "bunshi/react";
import { useSetAtom, useStore } from "jotai";
import { useCallback } from "react";

import { notificationApi } from "#app/shared/lib/notifications";
import type { ManuscriptTreeNode } from "#shared/rpc/worktree-tree-rpc";

import { useManuscript } from "../../../branch/branch-scopes";
import { useWorkbenchEditorActions } from "../../../editor/use-workbench-editor-actions";
import { findManuscriptChildIndex, findManuscriptParentId } from "../manuscript-tree";
import { manuscriptTreeMolecule } from "./manuscript-tree-molecule";
import type { ManuscriptEditingState, ManuscriptTreeState } from "./types";

type ManuscriptCreateTarget = {
  parentId: string;
  index: number;
};

function resolveCreateTarget(current: ManuscriptTreeState): ManuscriptCreateTarget {
  const snapshot = current.snapshot;
  if (snapshot === null) {
    return { parentId: "root", index: 0 };
  }

  const root = snapshot.nodes[snapshot.rootId];
  if (root?.type !== "folder") {
    return { parentId: snapshot.rootId, index: 0 };
  }

  const selectedId = current.selectedId;
  if (selectedId === null) {
    return { parentId: snapshot.rootId, index: root.childIds.length };
  }

  const selectedNode = snapshot.nodes[selectedId];
  if (selectedNode?.type === "folder") {
    return { parentId: selectedNode.id, index: selectedNode.childIds.length };
  }

  if (selectedNode?.type === "chapter") {
    const parentId = findManuscriptParentId(snapshot, selectedNode.id);
    if (parentId !== null) {
      const childIndex = findManuscriptChildIndex(snapshot, parentId, selectedNode.id);
      if (childIndex >= 0) {
        return { parentId, index: childIndex + 1 };
      }
    }
  }

  return { parentId: snapshot.rootId, index: root.childIds.length };
}

export function useManuscriptTreeActions() {
  const manuscript = useManuscript();
  const { treeAtom } = useMolecule(manuscriptTreeMolecule);
  const dispatch = useSetAtom(treeAtom);
  const store = useStore();
  const { focusTarget, openTarget } = useWorkbenchEditorActions();

  const startCreating = useCallback(
    (kind: ManuscriptTreeNode["type"]) => {
      const current = store.get(treeAtom);
      const target = resolveCreateTarget(current);
      dispatch({ type: "startCreating", kind, ...target });
    },
    [dispatch, store, treeAtom],
  );

  const startRenaming = useCallback(() => {
    const current = store.get(treeAtom);
    if (current.selectedId === null || current.snapshot === null || current.editing !== null) {
      return;
    }
    const node = current.snapshot.nodes[current.selectedId];
    if (node === undefined || node.id === "root") {
      return;
    }
    dispatch({ type: "startRenaming", id: node.id, kind: node.type });
  }, [dispatch, store, treeAtom]);

  const cancelEditing = useCallback(() => {
    dispatch({ type: "cancelEditing" });
  }, [dispatch]);

  const submitEditing = useCallback(
    async (editing: ManuscriptEditingState, title: string) => {
      dispatch({ type: "cancelEditing" });
      try {
        const result =
          editing.mode === "creating"
            ? editing.kind === "folder"
              ? await manuscript.createFolder(editing.parentId, title, editing.index)
              : await manuscript.createChapter(editing.parentId, title, editing.index)
            : (await manuscript.renameNode(editing.id, title), null);
        if (editing.mode === "creating" && editing.kind === "chapter" && result !== null) {
          openTarget({ kind: "manuscript", chapterId: result.nodeId });
        }
      } catch (error) {
        notificationApi.error(error instanceof Error ? error.message : "正文操作失败", {
          source: "正文",
        });
      }
    },
    [dispatch, manuscript, openTarget],
  );

  const selectNode = useCallback(
    (id: string) => {
      dispatch({ type: "select", id });
    },
    [dispatch],
  );

  const activateNode = useCallback(
    (id: string, type: ManuscriptTreeNode["type"], _title: string, intent: "focus" | "open") => {
      selectNode(id);
      if (type === "folder") {
        dispatch({ type: "toggleFolder", id });
        return;
      }
      const target = { kind: "manuscript" as const, chapterId: id };
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
    if (current.selectedId === null || current.snapshot === null) {
      return;
    }
    const node = current.snapshot.nodes[current.selectedId];
    if (node === undefined || node.id === "root") {
      return;
    }
    if (!confirm(`确定要删除「${node.title}」吗？`)) {
      return;
    }
    try {
      await manuscript.deleteNode(node.id);
    } catch (error) {
      notificationApi.error(error instanceof Error ? error.message : "删除正文节点失败", {
        source: "正文",
      });
    }
  }, [manuscript, store, treeAtom]);

  const moveNode = useCallback(
    async (sourceId: string, targetParentId: string, index?: number) => {
      try {
        await manuscript.moveNode(sourceId, targetParentId, index);
        dispatch({ type: "expand", id: targetParentId });
      } catch (error) {
        notificationApi.error(error instanceof Error ? error.message : "移动正文节点失败", {
          source: "正文",
        });
      }
    },
    [dispatch, manuscript],
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
