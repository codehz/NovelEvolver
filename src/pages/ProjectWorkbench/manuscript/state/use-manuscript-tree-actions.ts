import { useMolecule } from "bunshi/react";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import { useCallback } from "react";

import { notificationApi } from "#app/lib/notifications";
import type { ManuscriptNode } from "#shared/rpc/projects-rpc";

import { useManuscript } from "../../demo/branch/branch-scopes";
import { useWorkbenchEditorActions } from "../../demo/editor/use-workbench-editor-actions";
import {
  collectManuscriptChapterIds,
  findManuscriptChildIndex,
  findManuscriptParentId,
} from "../manuscript-tree";
import { manuscriptTreeMolecule } from "./manuscript-tree-molecule";
import type { ManuscriptEditingState, ManuscriptTreeState } from "./types";

type ManuscriptCreateTarget = {
  parentId: string;
  index: number;
};

function resolveCreateTarget(current: ManuscriptTreeState): ManuscriptCreateTarget {
  const outline = current.outline;
  if (outline === null) {
    return { parentId: "root", index: 0 };
  }

  const root = outline.nodes[outline.rootId];
  if (root?.type !== "folder") {
    return { parentId: outline.rootId, index: 0 };
  }

  const selectedId = current.selectedId;
  if (selectedId === null) {
    return { parentId: outline.rootId, index: root.children.length };
  }

  const selectedNode = outline.nodes[selectedId];
  if (selectedNode?.type === "folder") {
    return { parentId: selectedNode.id, index: selectedNode.children.length };
  }

  if (selectedNode?.type === "chapter") {
    const parentId = findManuscriptParentId(outline, selectedNode.id);
    if (parentId !== null) {
      const childIndex = findManuscriptChildIndex(outline, parentId, selectedNode.id);
      if (childIndex >= 0) {
        return { parentId, index: childIndex + 1 };
      }
    }
  }

  return { parentId: outline.rootId, index: root.children.length };
}

export function useManuscriptTreeActions() {
  const manuscript = useManuscript();
  const { treeAtom } = useMolecule(manuscriptTreeMolecule);
  const state = useAtomValue(treeAtom);
  const dispatch = useSetAtom(treeAtom);
  const store = useStore();
  const { openManuscriptTab, renameManuscriptTab, closeManuscriptTabs } =
    useWorkbenchEditorActions();

  const startCreating = useCallback(
    (kind: ManuscriptNode["type"]) => {
      const current = store.get(treeAtom);
      const target = resolveCreateTarget(current);
      dispatch({ type: "startCreating", kind, ...target });
    },
    [dispatch, store, treeAtom],
  );

  const startRenaming = useCallback(() => {
    const current = store.get(treeAtom);
    if (current.selectedId === null || current.outline === null || current.editing !== null) {
      return;
    }
    const node = current.outline.nodes[current.selectedId];
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
        const outline =
          editing.mode === "creating"
            ? editing.kind === "folder"
              ? await manuscript.createFolder(editing.parentId, title, editing.index)
              : await manuscript.createChapter(editing.parentId, title, editing.index)
            : await manuscript.renameNode(editing.id, title);
        dispatch({ type: "setOutline", outline });
        if (editing.mode === "renaming" && editing.kind === "chapter") {
          renameManuscriptTab(editing.id, title);
        }
      } catch (error) {
        notificationApi.error(error instanceof Error ? error.message : "正文操作失败", {
          source: "正文",
        });
      }
    },
    [dispatch, manuscript, renameManuscriptTab],
  );

  const activateNode = useCallback(
    (id: string, type: ManuscriptNode["type"], title: string) => {
      dispatch({ type: "select", id });
      if (type === "folder") {
        dispatch({ type: "toggleFolder", id });
        return;
      }
      void openManuscriptTab(id, title, (chapterId) => manuscript.readChapter(chapterId));
    },
    [dispatch, manuscript, openManuscriptTab],
  );

  const deleteNode = useCallback(async () => {
    const current = store.get(treeAtom);
    if (current.selectedId === null || current.outline === null) {
      return;
    }
    const node = current.outline.nodes[current.selectedId];
    if (node === undefined || node.id === "root") {
      return;
    }
    if (!confirm(`确定要删除「${node.title}」吗？`)) {
      return;
    }
    const chapterIds = collectManuscriptChapterIds(current.outline, node.id);
    try {
      const outline = await manuscript.deleteNode(node.id);
      closeManuscriptTabs(chapterIds);
      dispatch({ type: "setOutline", outline });
    } catch (error) {
      notificationApi.error(error instanceof Error ? error.message : "删除正文节点失败", {
        source: "正文",
      });
    }
  }, [closeManuscriptTabs, dispatch, manuscript, store, treeAtom]);

  const moveNode = useCallback(
    async (sourceId: string, targetParentId: string, index?: number) => {
      try {
        const outline = await manuscript.moveNode(sourceId, targetParentId, index);
        dispatch({ type: "setOutline", outline });
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
    state,
    startCreating,
    startRenaming,
    cancelEditing,
    submitEditing,
    activateNode,
    deleteNode,
    moveNode,
  };
}
