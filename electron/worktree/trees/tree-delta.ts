import type {
  ManuscriptTreeDelta,
  ManuscriptTreeNode,
  ManuscriptTreeSnapshot,
  ResourceTreeDelta,
  ResourceTreeNode,
  ResourceTreeSnapshot,
  TreeChildrenPatch,
} from "#shared/rpc/worktree-tree-rpc";

function childIdsEqual(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
}

function manuscriptNodeFieldsEqual(before: ManuscriptTreeNode, after: ManuscriptTreeNode): boolean {
  return (
    before.id === after.id &&
    before.type === after.type &&
    before.title === after.title &&
    before.parentId === after.parentId &&
    before.changeStatus === after.changeStatus
  );
}

function resourceNodeFieldsEqual(before: ResourceTreeNode, after: ResourceTreeNode): boolean {
  return (
    before.id === after.id &&
    before.type === after.type &&
    before.name === after.name &&
    before.parentId === after.parentId &&
    before.changeStatus === after.changeStatus
  );
}

function cloneManuscriptNodeForDelta(node: ManuscriptTreeNode): ManuscriptTreeNode {
  return {
    ...node,
    childIds: [...node.childIds],
  };
}

function cloneResourceNodeForDelta(node: ResourceTreeNode): ResourceTreeNode {
  return {
    ...node,
    childIds: [...node.childIds],
  };
}

function collectFolderParentIds(snapshot: {
  rootId: string;
  nodes: Record<string, { type: string; parentId: string | null; childIds: string[] }>;
}): Set<string> {
  const parentIds = new Set<string>([snapshot.rootId]);
  for (const [nodeId, node] of Object.entries(snapshot.nodes)) {
    if (node.type === "folder") {
      parentIds.add(nodeId);
    }
  }
  return parentIds;
}

export function isEmptyManuscriptTreeDelta(delta: ManuscriptTreeDelta): boolean {
  return (
    delta.deleteNodeIds.length === 0 &&
    Object.keys(delta.putNodes).length === 0 &&
    delta.setChildren.length === 0
  );
}

export function isEmptyResourceTreeDelta(delta: ResourceTreeDelta): boolean {
  return (
    delta.deleteNodeIds.length === 0 &&
    Object.keys(delta.putNodes).length === 0 &&
    delta.setChildren.length === 0
  );
}

export function computeManuscriptTreeDelta(
  before: ManuscriptTreeSnapshot,
  after: ManuscriptTreeSnapshot,
): ManuscriptTreeDelta | undefined {
  const deleteNodeIds: string[] = [];
  const putNodes: Record<string, ManuscriptTreeNode> = {};
  const setChildren: TreeChildrenPatch[] = [];

  for (const nodeId of Object.keys(before.nodes)) {
    if (after.nodes[nodeId] === undefined) {
      deleteNodeIds.push(nodeId);
    }
  }

  for (const [nodeId, afterNode] of Object.entries(after.nodes)) {
    const beforeNode = before.nodes[nodeId];
    if (beforeNode === undefined || !manuscriptNodeFieldsEqual(beforeNode, afterNode)) {
      putNodes[nodeId] = cloneManuscriptNodeForDelta(afterNode);
    }
  }

  const parentIds = new Set<string>([
    ...collectFolderParentIds(before),
    ...collectFolderParentIds(after),
  ]);
  for (const parentId of parentIds) {
    const beforeChildren = before.nodes[parentId]?.childIds ?? [];
    const afterChildren = after.nodes[parentId]?.childIds ?? [];
    if (!childIdsEqual(beforeChildren, afterChildren)) {
      setChildren.push({ parentId, childIds: [...afterChildren] });
    }
  }

  const delta: ManuscriptTreeDelta = { putNodes, deleteNodeIds, setChildren };
  return isEmptyManuscriptTreeDelta(delta) ? undefined : delta;
}

export function computeResourceTreeDelta(
  before: ResourceTreeSnapshot,
  after: ResourceTreeSnapshot,
): ResourceTreeDelta | undefined {
  const deleteNodeIds: string[] = [];
  const putNodes: Record<string, ResourceTreeNode> = {};
  const setChildren: TreeChildrenPatch[] = [];

  for (const nodeId of Object.keys(before.nodes)) {
    if (after.nodes[nodeId] === undefined) {
      deleteNodeIds.push(nodeId);
    }
  }

  for (const [nodeId, afterNode] of Object.entries(after.nodes)) {
    const beforeNode = before.nodes[nodeId];
    if (beforeNode === undefined || !resourceNodeFieldsEqual(beforeNode, afterNode)) {
      putNodes[nodeId] = cloneResourceNodeForDelta(afterNode);
    }
  }

  const parentIds = new Set<string>([
    ...collectFolderParentIds(before),
    ...collectFolderParentIds(after),
  ]);
  for (const parentId of parentIds) {
    const beforeChildren = before.nodes[parentId]?.childIds ?? [];
    const afterChildren = after.nodes[parentId]?.childIds ?? [];
    if (!childIdsEqual(beforeChildren, afterChildren)) {
      setChildren.push({ parentId, childIds: [...afterChildren] });
    }
  }

  const delta: ResourceTreeDelta = { putNodes, deleteNodeIds, setChildren };
  return isEmptyResourceTreeDelta(delta) ? undefined : delta;
}
