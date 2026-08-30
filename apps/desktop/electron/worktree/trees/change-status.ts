import type { FileChangeStatus } from "#domain/worktree";

type ChangeTrackedNode = {
  id: string;
  type: string;
  parentId: string | null;
  childIds: string[];
  changeStatus?: FileChangeStatus;
};

type ChangeTrackedTree<TNode extends ChangeTrackedNode> = {
  rootId: string;
  nodes: Record<string, TNode>;
};

function folderHasChangedChildren<TNode extends ChangeTrackedNode>(
  tree: ChangeTrackedTree<TNode>,
  folderId: string,
): boolean {
  const folder = tree.nodes[folderId];
  if (!folder || folder.type !== "folder") {
    return false;
  }
  return folder.childIds.some((childId) => tree.nodes[childId]?.changeStatus !== undefined);
}

export function refreshFolderChangeStatusFromChildren<TNode extends ChangeTrackedNode>(
  tree: ChangeTrackedTree<TNode>,
  folderId: string,
): boolean {
  const folder = tree.nodes[folderId];
  if (!folder || folder.type !== "folder") {
    return false;
  }
  const previous = folder.changeStatus;
  if (folderHasChangedChildren(tree, folderId)) {
    folder.changeStatus = folder.changeStatus ?? "modified";
  } else {
    delete folder.changeStatus;
  }
  return folder.changeStatus !== previous;
}

export function refreshAllFolderChangeStatuses<TNode extends ChangeTrackedNode>(
  tree: ChangeTrackedTree<TNode>,
): void {
  const visit = (nodeId: string): void => {
    const node = tree.nodes[nodeId];
    if (!node || node.type !== "folder") {
      return;
    }
    for (const childId of node.childIds) {
      visit(childId);
    }
    refreshFolderChangeStatusFromChildren(tree, nodeId);
  };

  visit(tree.rootId);
}

export function propagateFolderChangeStatusUp<TNode extends ChangeTrackedNode>(
  tree: ChangeTrackedTree<TNode>,
  nodeId: string,
  putNodes: Record<string, TNode>,
  cloneNode: (node: TNode) => TNode,
): void {
  let parentId = tree.nodes[nodeId]?.parentId;
  while (parentId !== null && parentId !== undefined) {
    const parent = tree.nodes[parentId];
    if (!parent || parent.type !== "folder") {
      break;
    }
    if (refreshFolderChangeStatusFromChildren(tree, parentId)) {
      putNodes[parentId] = cloneNode(parent);
    }
    parentId = parent.parentId;
  }
}
