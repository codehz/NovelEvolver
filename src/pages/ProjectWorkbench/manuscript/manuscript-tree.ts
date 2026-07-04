import type { ManuscriptNode, ManuscriptOutline } from "#shared/rpc/projects-rpc";

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
  const chain: ManuscriptNode[] = [];
  let currentId: string | null = id;
  while (currentId !== null) {
    const node = outline.nodes[currentId];
    if (node === undefined) {
      break;
    }
    chain.unshift(node);
    currentId = findManuscriptParentId(outline, currentId);
  }
  return chain;
}

export function findManuscriptParentId(outline: ManuscriptOutline, id: string): string | null {
  for (const node of Object.values(outline.nodes)) {
    if (node.type === "folder" && node.children.includes(id)) {
      return node.id;
    }
  }
  return null;
}

export function findManuscriptChildIndex(
  outline: ManuscriptOutline,
  parentId: string,
  childId: string,
): number {
  const parent = outline.nodes[parentId];
  if (parent?.type !== "folder") {
    return -1;
  }
  return parent.children.indexOf(childId);
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
  const ancestor = outline.nodes[ancestorId];
  if (ancestor?.type !== "folder") {
    return false;
  }
  for (const childId of ancestor.children) {
    if (childId === candidateId || isManuscriptDescendant(outline, childId, candidateId)) {
      return true;
    }
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
