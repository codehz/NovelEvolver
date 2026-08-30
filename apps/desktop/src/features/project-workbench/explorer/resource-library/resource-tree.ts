import type { ResourceTreeNode, ResourceTreeSnapshot } from "#shared/rpc/worktree/index";

type ResourceTreeMetadata = {
  parentById: Map<string, string>;
  depthById: Map<string, number>;
  pathById: Map<string, string>;
};

const resourceTreeMetadataCache = new WeakMap<ResourceTreeSnapshot, ResourceTreeMetadata>();

function getResourceTreeMetadata(snapshot: ResourceTreeSnapshot): ResourceTreeMetadata {
  const cached = resourceTreeMetadataCache.get(snapshot);
  if (cached !== undefined) {
    return cached;
  }

  const parentById = new Map<string, string>();
  const depthById = new Map<string, number>([[snapshot.rootId, -1]]);
  const pathById = new Map<string, string>([[snapshot.rootId, ""]]);

  const visit = (parentId: string): void => {
    const parent = snapshot.nodes[parentId];
    if (parent?.type !== "folder") {
      return;
    }
    const parentDepth = depthById.get(parentId) ?? -1;
    const parentPath = pathById.get(parentId) ?? "";
    for (const childId of parent.childIds) {
      const child = snapshot.nodes[childId];
      if (child === undefined) {
        continue;
      }
      parentById.set(childId, parentId);
      depthById.set(childId, parentDepth + 1);
      pathById.set(childId, parentPath === "" ? child.name : `${parentPath}/${child.name}`);
      if (child.type === "folder") {
        visit(childId);
      }
    }
  };

  visit(snapshot.rootId);

  const metadata = { parentById, depthById, pathById };
  resourceTreeMetadataCache.set(snapshot, metadata);
  return metadata;
}

export type ResourceFlatTreeNode = {
  id: string;
  name: string;
  type: ResourceTreeNode["type"];
  depth: number;
  expanded: boolean;
};

export function resourceNodeChildren(
  snapshot: ResourceTreeSnapshot,
  parentId: string,
): ResourceTreeNode[] {
  const parent = snapshot.nodes[parentId];
  if (parent?.type !== "folder") {
    return [];
  }
  return parent.childIds.map((id) => snapshot.nodes[id]).filter((node) => node !== undefined);
}

export function resourceParentChain(
  snapshot: ResourceTreeSnapshot,
  id: string,
): ResourceTreeNode[] {
  const { parentById } = getResourceTreeMetadata(snapshot);
  const chain: ResourceTreeNode[] = [];
  let currentId: string | null = id;
  while (currentId !== null) {
    const node = snapshot.nodes[currentId];
    if (node === undefined) {
      break;
    }
    chain.unshift(node);
    currentId = parentById.get(currentId) ?? null;
  }
  return chain;
}

export function findResourceParentId(snapshot: ResourceTreeSnapshot, id: string): string | null {
  return getResourceTreeMetadata(snapshot).parentById.get(id) ?? null;
}

export function getResourceNodeDepth(snapshot: ResourceTreeSnapshot, id: string): number {
  return getResourceTreeMetadata(snapshot).depthById.get(id) ?? -1;
}

export function getResourceNodePath(snapshot: ResourceTreeSnapshot, id: string): string {
  return getResourceTreeMetadata(snapshot).pathById.get(id) ?? "";
}

export function isResourceDescendant(
  snapshot: ResourceTreeSnapshot,
  ancestorId: string,
  candidateId: string,
): boolean {
  const { parentById } = getResourceTreeMetadata(snapshot);
  let currentId = parentById.get(candidateId) ?? null;
  while (currentId !== null) {
    if (currentId === ancestorId) {
      return true;
    }
    currentId = parentById.get(currentId) ?? null;
  }
  return false;
}

export function flattenResourceTree(
  snapshot: ResourceTreeSnapshot,
  expandedIds: Record<string, true>,
): ResourceFlatTreeNode[] {
  const result: ResourceFlatTreeNode[] = [];

  const visit = (parentId: string, depth: number): void => {
    for (const node of resourceNodeChildren(snapshot, parentId)) {
      const expanded = node.type === "folder" && expandedIds[node.id] === true;
      result.push({
        id: node.id,
        name: node.name,
        type: node.type,
        depth,
        expanded,
      });
      if (expanded) {
        visit(node.id, depth + 1);
      }
    }
  };

  visit(snapshot.rootId, 0);
  return result;
}
