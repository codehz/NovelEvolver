import { useMolecule } from "bunshi/react";
import { useSetAtom, useStore } from "jotai";
import { useCallback } from "react";

import { confirmDialogApi } from "#app/shared/lib/confirm-dialog";
import { notificationApi } from "#app/shared/lib/notifications";
import type {
  ExternalImportEntry,
  ExternalImportSkip,
  ExternalImportSkipReason,
  ManuscriptImportCreated,
  ManuscriptTreeNode,
} from "#shared/rpc/worktree/index";
import { useWorkbenchEditorActions } from "#workbench/editor/use-workbench-editor-actions";
import { useManuscript } from "#workbench/session/workspace-handles";

import { findManuscriptChildIndex, findManuscriptParentId } from "../manuscript-tree";
import { manuscriptTreeMolecule } from "./manuscript-tree-molecule";
import type { ManuscriptEditingState, ManuscriptMoveTarget, ManuscriptTreeState } from "./types";

const SKIP_REASON_LABEL: Record<ExternalImportSkipReason, string> = {
  "name-conflict": "同名冲突",
  "type-conflict": "类型冲突",
  "invalid-name": "名称无效",
  "too-large": "文件过大",
  "empty-path": "路径为空",
  "invalid-utf8": "非 UTF-8 文本",
  unreadable: "无法读取",
  "missing-parent": "缺少父目录",
};

function formatSkipDetail(skip: ExternalImportSkip): string {
  const reason = SKIP_REASON_LABEL[skip.reason] ?? skip.reason;
  const detail = skip.message != null && skip.message !== "" ? ` — ${skip.message}` : "";
  return `• ${skip.relativePath || "(根)"}：${reason}${detail}`;
}

function showImportSummary(
  created: ManuscriptImportCreated[],
  skipped: ExternalImportSkip[],
): void {
  const createdCount = created.length;
  const skippedCount = skipped.length;
  if (createdCount === 0 && skippedCount === 0) {
    notificationApi.info("没有可导入的文件", { source: "正文" });
    return;
  }

  let message: string;
  if (createdCount === 0) {
    message = `全部跳过（${skippedCount} 项）`;
  } else if (skippedCount === 0) {
    message = createdCount === 1 ? "已导入 1 项" : `已导入 ${createdCount} 项`;
  } else {
    message = `已导入 ${createdCount} 项，跳过 ${skippedCount} 项`;
  }

  const severity = createdCount === 0 || skippedCount > 0 ? "warning" : "info";
  const actions =
    skippedCount === 0
      ? undefined
      : [
          {
            label: "详情",
            onClick: async () => {
              await confirmDialogApi.confirm({
                title: "导入详情",
                description: skipped.map(formatSkipDetail).join("\n"),
                confirmLabel: "知道了",
                cancelLabel: "关闭",
              });
            },
          },
        ];

  notificationApi.show({
    severity,
    message,
    source: "正文",
    actions,
  });
}

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
    const confirmed = await confirmDialogApi.confirm({
      title: "删除",
      description: `确定要删除「${node.title}」吗？`,
      confirmLabel: "删除",
      tone: "danger",
    });
    if (!confirmed) {
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

  const importExternalEntries = useCallback(
    async (
      target: ManuscriptMoveTarget,
      entries: readonly ExternalImportEntry[],
      localSkips: readonly ExternalImportSkip[] = [],
    ) => {
      if (entries.length === 0) {
        showImportSummary([], [...localSkips]);
        return;
      }

      const parentId = target.parentId;
      const index = target.kind === "insert" ? target.index : undefined;

      try {
        const result = await manuscript.importEntries(parentId, entries, index);
        const created = result.created;
        const skipped = [...localSkips, ...result.skipped];

        dispatch({ type: "expand", id: parentId });
        for (const item of created) {
          if (item.kind === "folder") {
            dispatch({ type: "expand", id: item.nodeId });
          }
        }

        const first = created[0];
        if (first !== undefined) {
          dispatch({ type: "select", id: first.nodeId });
          const onlyOneChapter = created.length === 1 && first.kind === "chapter";
          if (onlyOneChapter) {
            openTarget({ kind: "manuscript", chapterId: first.nodeId });
          }
        }

        showImportSummary(created, skipped);
      } catch (error) {
        notificationApi.error(error instanceof Error ? error.message : "导入失败", {
          source: "正文",
        });
      }
    },
    [dispatch, manuscript, openTarget],
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
    importExternalEntries,
  };
}
