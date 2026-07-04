import type { ManuscriptNode, ManuscriptOutline } from "#shared/rpc/projects-rpc";

type ManuscriptTreeMetadata = {
  parentById: Map<string, string>;
  childIndexById: Map<string, number>;
  depthById: Map<string, number>;
};

const manuscriptTreeMetadataCache = new WeakMap<ManuscriptOutline, ManuscriptTreeMetadata>();

function getManuscriptTreeMetadata(outline: ManuscriptOutline): ManuscriptTreeMetadata {
  const cached = manuscriptTreeMetadataCache.get(outline);
  if (cached !== undefined) {
    return cached;
  }

  const parentById = new Map<string, string>();
  const childIndexById = new Map<string, number>();
  const depthById = new Map<string, number>([[outline.rootId, -1]]);

  const visit = (parentId: string): void => {
    const parent = outline.nodes[parentId];
    if (parent?.type !== "folder") {
      return;
    }

    const parentDepth = depthById.get(parentId) ?? -1;
    for (const [index, childId] of parent.children.entries()) {
      parentById.set(childId, parentId);
      childIndexById.set(childId, index);
      depthById.set(childId, parentDepth + 1);

      if (outline.nodes[childId]?.type === "folder") {
        visit(childId);
      }
    }
  };

  visit(outline.rootId);

  const metadata = {
    parentById,
    childIndexById,
    depthById,
  };
  manuscriptTreeMetadataCache.set(outline, metadata);
  return metadata;
}

export type ManuscriptTreeNode = {
  id: string;
  title: string;
  type: ManuscriptNode["type"];
  depth: number;
  expanded: boolean;
};

export function manuscriptNodeChildren(
  outline: ManuscriptOutline,
  parentId: string,
): ManuscriptNode[] {
  const parent = outline.nodes[parentId];
  if (parent?.type !== "folder") {
    return [];
  }
  return parent.children.map((id) => outline.nodes[id]).filter((node) => node !== undefined);
}

export function manuscriptParentChain(outline: ManuscriptOutline, id: string): ManuscriptNode[] {
  const { parentById } = getManuscriptTreeMetadata(outline);
  const chain: ManuscriptNode[] = [];
  let currentId: string | null = id;
  while (currentId !== null) {
    const node = outline.nodes[currentId];
    if (node === undefined) {
      break;
    }
    chain.unshift(node);
    currentId = parentById.get(currentId) ?? null;
  }
  return chain;
}

export function findManuscriptParentId(outline: ManuscriptOutline, id: string): string | null {
  return getManuscriptTreeMetadata(outline).parentById.get(id) ?? null;
}

export function findManuscriptChildIndex(
  outline: ManuscriptOutline,
  parentId: string,
  childId: string,
): number {
  const metadata = getManuscriptTreeMetadata(outline);
  if (metadata.parentById.get(childId) !== parentId) {
    return -1;
  }
  return metadata.childIndexById.get(childId) ?? -1;
}

export function getManuscriptNodeDepth(outline: ManuscriptOutline, id: string): number {
  return getManuscriptTreeMetadata(outline).depthById.get(id) ?? -1;
}

export function collectManuscriptChapterIds(outline: ManuscriptOutline, id: string): string[] {
  const node = outline.nodes[id];
  if (node === undefined) {
    return [];
  }
  if (node.type === "chapter") {
    return [id];
  }
  return node.children.flatMap((childId) => collectManuscriptChapterIds(outline, childId));
}

export function isManuscriptDescendant(
  outline: ManuscriptOutline,
  ancestorId: string,
  candidateId: string,
): boolean {
  const { parentById } = getManuscriptTreeMetadata(outline);
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
  outline: ManuscriptOutline,
  expandedIds: Record<string, true>,
): ManuscriptTreeNode[] {
  const result: ManuscriptTreeNode[] = [];

  function visit(parentId: string, depth: number): void {
    for (const node of manuscriptNodeChildren(outline, parentId)) {
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

  visit(outline.rootId, 0);
  return result;
}
