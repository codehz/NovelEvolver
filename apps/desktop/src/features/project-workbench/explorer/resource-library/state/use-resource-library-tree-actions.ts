import { normalizeResourceNameInput } from "@novelevolver/domain/resource-library-path";
import type {
  ResourceImportCreated,
  ResourceImportEntry,
  ResourceImportSkip,
  ResourceImportSkipReason,
  ResourceTreeSnapshot,
} from "@novelevolver/domain/worktree";
import { useMolecule } from "bunshi/react";
import { useSetAtom, useStore } from "jotai";
import { useCallback, useRef } from "react";

import { useWorkbenchEditorActions } from "#app/features/project-workbench/editor/use-workbench-editor-actions";
import { useResourceLibrary } from "#app/features/project-workbench/session/workspace-handles";
import { confirmDialogApi } from "#app/shared/lib/confirm-dialog";
import { notificationApi } from "#app/shared/lib/notifications";

import { findResourceParentId } from "../resource-tree";
import { resourceLibraryTreeMolecule } from "./resource-tree-molecule";
import type { ResourceTreeEditingState, ResourceTreeSelection } from "./types";

const SKIP_REASON_LABEL: Record<ResourceImportSkipReason, string> = {
  "name-conflict": "同名冲突",
  "type-conflict": "类型冲突",
  "invalid-name": "名称无效",
  "too-large": "文件过大",
  "empty-path": "路径为空",
  "invalid-utf8": "非 UTF-8 文本",
  unreadable: "无法读取",
  "missing-parent": "缺少父目录",
};

function formatSkipDetail(skip: ResourceImportSkip): string {
  const reason = SKIP_REASON_LABEL[skip.reason] ?? skip.reason;
  const detail = skip.message != null && skip.message !== "" ? ` — ${skip.message}` : "";
  return `• ${skip.relativePath || "(根)"}：${reason}${detail}`;
}

function showImportSummary(created: ResourceImportCreated[], skipped: ResourceImportSkip[]): void {
  const createdCount = created.length;
  const skippedCount = skipped.length;
  if (createdCount === 0 && skippedCount === 0) {
    notificationApi.info("没有可导入的文件", { source: "资源库" });
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
    source: "资源库",
    actions,
  });
}

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
    const confirmed = await confirmDialogApi.confirm({
      title: "删除",
      description: `确定要删除「${node.name}」吗？`,
      confirmLabel: "删除",
      tone: "danger",
    });
    if (!confirmed) {
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

  const importExternalEntries = useCallback(
    async (
      targetParentId: string,
      entries: readonly ResourceImportEntry[],
      localSkips: readonly ResourceImportSkip[] = [],
    ) => {
      if (entries.length === 0) {
        showImportSummary([], [...localSkips]);
        return;
      }

      try {
        const result = await resources.importEntries(targetParentId, entries);
        const created = result.created;
        const skipped = [...localSkips, ...result.skipped];

        dispatch({ type: "expandPath", id: targetParentId });
        for (const item of created) {
          if (item.kind === "folder") {
            dispatch({ type: "expandPath", id: item.nodeId });
          }
        }

        const first = created[0];
        if (first !== undefined) {
          dispatch({ type: "select", id: first.nodeId, nodeType: first.kind });
          const onlyOneFile = created.length === 1 && first.kind === "file";
          if (onlyOneFile) {
            openTarget({ kind: "resource", resourceId: first.nodeId });
          }
        }

        showImportSummary(created, skipped);
      } catch (error) {
        notificationApi.error(error instanceof Error ? error.message : "导入失败", {
          source: "资源库",
        });
      }
    },
    [dispatch, openTarget, resources],
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
