import type {
  ManuscriptTreeNode as SharedManuscriptTreeNode,
  ManuscriptTreeSnapshot,
} from "#domain/worktree";

type ManuscriptTreeMetadata = {
  parentById: Map<string, string>;
  childIndexById: Map<string, number>;
  depthById: Map<string, number>;
};

const manuscriptTreeMetadataCache = new WeakMap<ManuscriptTreeSnapshot, ManuscriptTreeMetadata>();

function getManuscriptTreeMetadata(snapshot: ManuscriptTreeSnapshot): ManuscriptTreeMetadata {
  const cached = manuscriptTreeMetadataCache.get(snapshot);
  if (cached !== undefined) {
    return cached;
  }

  const parentById = new Map<string, string>();
  const childIndexById = new Map<string, number>([[snapshot.rootId, 0]]);
  const depthById = new Map<string, number>([[snapshot.rootId, -1]]);

  const visit = (parentId: string): void => {
    const parent = snapshot.nodes[parentId];
    if (parent === undefined) {
      return;
    }

    const parentDepth = depthById.get(parentId) ?? -1;
    for (const [index, childId] of parent.childIds.entries()) {
      parentById.set(childId, parentId);
      childIndexById.set(childId, index);
      depthById.set(childId, parentDepth + 1);

      if (snapshot.nodes[childId]?.type === "folder") {
        visit(childId);
      }
    }
  };

  visit(snapshot.rootId);

  const metadata = {
    parentById,
    childIndexById,
    depthById,
  };
  manuscriptTreeMetadataCache.set(snapshot, metadata);
  return metadata;
}

export type ManuscriptFlatTreeNode = {
  id: string;
  title: string;
  type: SharedManuscriptTreeNode["type"];
  depth: number;
  expanded: boolean;
};

export function manuscriptNodeChildren(
  snapshot: ManuscriptTreeSnapshot,
  parentId: string,
): SharedManuscriptTreeNode[] {
  const parent = snapshot.nodes[parentId];
  if (parent?.type !== "folder") {
    return [];
  }
  return parent.childIds.map((id) => snapshot.nodes[id]).filter((node) => node !== undefined);
}

export function manuscriptParentChain(
  snapshot: ManuscriptTreeSnapshot,
  id: string,
): SharedManuscriptTreeNode[] {
  const { parentById } = getManuscriptTreeMetadata(snapshot);
  const chain: SharedManuscriptTreeNode[] = [];
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

export function findManuscriptParentId(
  snapshot: ManuscriptTreeSnapshot,
  id: string,
): string | null {
  return getManuscriptTreeMetadata(snapshot).parentById.get(id) ?? null;
}

export function findManuscriptChildIndex(
  snapshot: ManuscriptTreeSnapshot,
  parentId: string,
  childId: string,
): number {
  const metadata = getManuscriptTreeMetadata(snapshot);
  if (metadata.parentById.get(childId) !== parentId) {
    return -1;
  }
  return metadata.childIndexById.get(childId) ?? -1;
}

export function getManuscriptNodeDepth(snapshot: ManuscriptTreeSnapshot, id: string): number {
  return getManuscriptTreeMetadata(snapshot).depthById.get(id) ?? -1;
}

/**
 * Title path from root children downward (excludes root itself).
 * Example: `卷一/第三章`. Root id → `""`.
 */
export function getManuscriptNodePath(snapshot: ManuscriptTreeSnapshot, id: string): string {
  if (id === snapshot.rootId) {
    return "";
  }
  const chain = manuscriptParentChain(snapshot, id);
  // Drop root title from path segments.
  return chain
    .filter((node) => node.id !== snapshot.rootId)
    .map((node) => node.title)
    .join("/");
}

export function collectManuscriptChapterIds(
  snapshot: ManuscriptTreeSnapshot,
  id: string,
): string[] {
  const node = snapshot.nodes[id];
  if (node === undefined) {
    return [];
  }
  if (node.type === "chapter") {
    return [id];
  }
  return node.childIds.flatMap((childId) => collectManuscriptChapterIds(snapshot, childId));
}

export function isManuscriptDescendant(
  snapshot: ManuscriptTreeSnapshot,
  ancestorId: string,
  candidateId: string,
): boolean {
  const { parentById } = getManuscriptTreeMetadata(snapshot);
  let currentId = parentById.get(candidateId) ?? null;
  while (currentId !== null) {
    if (currentId === ancestorId) {
      return true;
    }
    currentId = parentById.get(currentId) ?? null;
  }
  return false;
}

export function flattenManuscriptTree(
  snapshot: ManuscriptTreeSnapshot,
  expandedIds: Record<string, true>,
): ManuscriptFlatTreeNode[] {
  const result: ManuscriptFlatTreeNode[] = [];

  function visit(parentId: string, depth: number): void {
    for (const node of manuscriptNodeChildren(snapshot, parentId)) {
      const expanded = node.type === "folder" && expandedIds[node.id] === true;
      result.push({
        id: node.id,
        title: node.title,
        type: node.type,
        depth,
        expanded,
      });
      if (expanded) {
        visit(node.id, depth + 1);
      }
    }
  }

  visit(snapshot.rootId, 0);
  return result;
}
