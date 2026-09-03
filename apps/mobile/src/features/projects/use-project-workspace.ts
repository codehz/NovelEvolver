import type {
  ChangesSnapshot,
  ManuscriptNode,
  ResourceTreeNode,
  WorktreeDomain,
} from "@novelevolver/domain/worktree";
import { useEffect, useState } from "react";

import { useOverlay } from "../../shared/ui/OverlayHost";
import type { EditorDocument } from "./editor/editor-document";
import { errorMessage } from "./error-message";
import type { ExplorerDomain } from "./explorer/ExplorerDomainSelect";
import { containsManuscriptNode } from "./manuscript/manuscript-tree-flatten";
import { useProjectManager } from "./ProjectManagerProvider";
import type { ProjectWorkspaceProps } from "./ProjectWorkspace";
import { containsResourceNode, resourceCreateParentId } from "./resource/resource-tree-flatten";

export type ProjectWorkspaceModel = Omit<ProjectWorkspaceProps, "onBack">;

export function useProjectWorkspace(projectId: number): ProjectWorkspaceModel | null {
  const overlay = useOverlay();
  const manager = useProjectManager();
  const [opened, setOpened] = useState(
    manager.opened?.record.id === projectId ? manager.opened : null,
  );
  const [explorerDomain, setExplorerDomain] = useState<ExplorerDomain>("manuscript");
  const [selectedManuscriptId, setSelectedManuscriptId] = useState<string | null>(null);
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [editorDocument, setEditorDocument] = useState<EditorDocument | null>(null);
  const [revision, setRevision] = useState(0);
  const [changesSnapshot, setChangesSnapshot] = useState<ChangesSnapshot | null>(null);
  const [changesLoading, setChangesLoading] = useState(true);
  const [changesError, setChangesError] = useState(false);

  const openChapter = (nodeId: string) => {
    setSelectedManuscriptId(nodeId);
    setEditorDocument({ domain: "manuscript", id: nodeId });
  };
  const openResourceFile = (nodeId: string) => {
    setSelectedResourceId(nodeId);
    setEditorDocument({ domain: "resource", id: nodeId });
  };
  const refresh = () => {
    setRevision((value) => value + 1);
  };
  const run = async (title: string, action: () => void): Promise<boolean> => {
    try {
      action();
      refresh();
      return true;
    } catch (error) {
      await overlay.alert({ title, message: errorMessage(error) });
      return false;
    }
  };
  const clearEditorIfInSubtree = (
    domain: WorktreeDomain,
    ancestorId: string,
    contains: (ancestorId: string, targetId: string) => boolean,
  ) => {
    setEditorDocument((current) => {
      if (current === null || current.domain !== domain) return current;
      return contains(ancestorId, current.id) ? null : current;
    });
  };

  useEffect(() => {
    let active = true;
    const current = manager.opened?.record.id === projectId ? manager.opened : null;
    if (current !== null) {
      setOpened(current);
      return () => {
        active = false;
      };
    }
    const record = manager.records.find((item) => item.id === projectId);
    if (record === undefined)
      return () => {
        active = false;
      };
    void manager
      .openProject(record)
      .then((result) => {
        if (active) setOpened(result);
      })
      .catch((error) => {
        if (active) {
          void overlay.alert({ title: "打开失败", message: errorMessage(error) });
        }
      });
    return () => {
      active = false;
    };
  }, [manager, overlay, projectId]);

  useEffect(() => {
    if (opened === null) {
      return;
    }
    setChangesLoading(true);
    setChangesError(false);
    try {
      setChangesSnapshot(opened.worktree.getChangesSnapshot());
    } catch {
      setChangesSnapshot(null);
      setChangesError(true);
    } finally {
      setChangesLoading(false);
    }
  }, [opened, revision]);

  if (opened === null) return null;

  const outline = opened.worktree.getManuscriptOutline();
  const resourceTree = opened.worktree.getResourceTree();
  const createFolder = async () => {
    const name = await overlay.prompt({
      title: "新建文件夹",
      placeholder: "文件夹名称",
      confirmLabel: "创建",
    });
    if (name === null) return;
    await run("创建失败", () => {
      opened.worktree.createManuscriptFolder(outline.rootId, name);
    });
  };
  const createChapter = async (): Promise<boolean> => {
    const name = await overlay.prompt({
      title: "新建章节",
      placeholder: "章节名称",
      confirmLabel: "创建",
    });
    if (name === null) return false;
    try {
      const { nodeId } = opened.worktree.createManuscriptChapter(outline.rootId, name);
      refresh();
      openChapter(nodeId);
      return true;
    } catch (error) {
      await overlay.alert({ title: "创建失败", message: errorMessage(error) });
      return false;
    }
  };
  const createResourceFolder = async () => {
    const name = await overlay.prompt({
      title: "新建文件夹",
      placeholder: "文件夹名称",
      confirmLabel: "创建",
    });
    if (name === null) return;
    await run("创建失败", () => {
      opened.worktree.createResourceFolder(
        resourceCreateParentId(resourceTree, selectedResourceId),
        name,
      );
    });
  };
  const createResourceFile = async (): Promise<boolean> => {
    const name = await overlay.prompt({
      title: "新建文件",
      placeholder: "文件名称",
      confirmLabel: "创建",
    });
    if (name === null) return false;
    try {
      const { nodeId } = opened.worktree.createResourceFile(
        resourceCreateParentId(resourceTree, selectedResourceId),
        name,
      );
      refresh();
      openResourceFile(nodeId);
      return true;
    } catch (error) {
      await overlay.alert({ title: "创建失败", message: errorMessage(error) });
      return false;
    }
  };
  const renameNode = async (node: ManuscriptNode) => {
    const name = await overlay.prompt({
      title: "重命名",
      initialValue: node.title,
      confirmLabel: "保存",
    });
    if (name === null) return;
    await run("重命名失败", () => {
      opened.worktree.renameManuscriptNode(node.id, name);
    });
  };
  const deleteNode = async (node: ManuscriptNode) => {
    const confirmed = await overlay.confirm({
      title: "删除节点？",
      message: `将递归删除“${node.title}”及其子项。`,
      confirmLabel: "删除",
    });
    if (!confirmed) return;
    const ok = await run("删除失败", () => {
      opened.worktree.deleteManuscriptNode(node.id);
    });
    if (!ok) return;
    if (containsManuscriptNode(outline, node.id, selectedManuscriptId ?? "")) {
      setSelectedManuscriptId(null);
    }
    clearEditorIfInSubtree("manuscript", node.id, (ancestorId, targetId) =>
      containsManuscriptNode(outline, ancestorId, targetId),
    );
  };
  const moveNode = (sourceId: string, parentId: string, index?: number) => {
    void run("移动失败", () => {
      opened.worktree.moveManuscriptNode(sourceId, parentId, index);
    });
  };
  const renameResource = async (node: ResourceTreeNode) => {
    const name = await overlay.prompt({
      title: "重命名",
      initialValue: node.name,
      confirmLabel: "保存",
    });
    if (name === null) return;
    await run("重命名失败", () => {
      opened.worktree.renameResourceNode(node.id, name);
    });
  };
  const deleteResource = async (node: ResourceTreeNode) => {
    const confirmed = await overlay.confirm({
      title: "删除节点？",
      message: `将递归删除“${node.name}”及其子项。`,
      confirmLabel: "删除",
    });
    if (!confirmed) return;
    const ok = await run("删除失败", () => {
      opened.worktree.deleteResourceNode(node.id);
    });
    if (!ok) return;
    if (containsResourceNode(resourceTree, node.id, selectedResourceId ?? "")) {
      setSelectedResourceId(null);
    }
    clearEditorIfInSubtree("resource", node.id, (ancestorId, targetId) =>
      containsResourceNode(resourceTree, ancestorId, targetId),
    );
  };
  const moveResource = (sourceId: string, parentId: string) => {
    void run("移动失败", () => {
      opened.worktree.moveResourceNode(sourceId, parentId);
    });
  };
  const revertChange = async (changeId: string) => {
    try {
      const updated = opened.worktree.revertChange(changeId);
      setChangesSnapshot(updated);
      refresh();
    } catch (error) {
      await overlay.alert({ title: "还原失败", message: errorMessage(error) });
    }
  };
  const revertAllChanges = async () => {
    if (!changesSnapshot?.hasChanges) return;
    const confirmed = await overlay.confirm({
      title: "还原所有更改",
      message: "将丢弃当前工作区全部未提交修改，恢复到上次提交状态。此操作不可撤销。",
      confirmLabel: "还原全部",
    });
    if (!confirmed) return;
    try {
      const updated = opened.worktree.revertAllChanges();
      setChangesSnapshot(updated);
      refresh();
    } catch (error) {
      await overlay.alert({ title: "还原失败", message: errorMessage(error) });
    }
  };
  const commitChanges = async (message: string) => {
    const trimmed = message.trim();
    if (trimmed === "" || !changesSnapshot?.hasChanges) return false;
    try {
      const updated = opened.worktree.commitChanges(trimmed, {
        name: "NovelEvolver",
        email: "app@novel-evolver.local",
      });
      setChangesSnapshot(updated);
      refresh();
      return true;
    } catch (error) {
      await overlay.alert({ title: "提交失败", message: errorMessage(error) });
      return false;
    }
  };

  return {
    opened,
    domain: explorerDomain,
    onDomainChange: setExplorerDomain,
    outline,
    resourceTree,
    selectedManuscriptId,
    selectedResourceId,
    warning: opened.worktree.warning,
    document: editorDocument,
    worktreeRevision: revision,
    onOpenChapter: openChapter,
    onOpenResourceFile: openResourceFile,
    onRenameManuscript: (node) => {
      void renameNode(node);
    },
    onDeleteManuscript: (node) => {
      void deleteNode(node);
    },
    onMoveManuscript: moveNode,
    onRenameResource: (node) => {
      void renameResource(node);
    },
    onDeleteResource: (node) => {
      void deleteResource(node);
    },
    onMoveResource: moveResource,
    onCreateFolder: () => {
      void createFolder();
    },
    onCreateChapter: createChapter,
    onCreateResourceFolder: () => {
      void createResourceFolder();
    },
    onCreateResourceFile: createResourceFile,
    onAiWorkspaceDirty: refresh,
    changesSnapshot,
    changesLoading,
    changesError,
    onRetryChanges: refresh,
    onRevertChange: (changeId) => {
      void revertChange(changeId);
    },
    onRevertAllChanges: () => {
      void revertAllChanges();
    },
    onCommitChanges: commitChanges,
  };
}
