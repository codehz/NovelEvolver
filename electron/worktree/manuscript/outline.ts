import type {
  ManuscriptChapterNode,
  ManuscriptFolderNode,
  ManuscriptNode,
  ManuscriptOutline,
} from "#shared/rpc/worktree/index";

import { assertValidManuscriptId } from "./paths";

export const MANUSCRIPT_ROOT_ID = "root";

export function createEmptyOutline(): ManuscriptOutline {
  return {
    version: 1,
    rootId: MANUSCRIPT_ROOT_ID,
    nodes: {
      [MANUSCRIPT_ROOT_ID]: {
        id: MANUSCRIPT_ROOT_ID,
        type: "folder",
        title: "手稿",
        children: [],
      },
    },
  };
}

export function normalizeManuscriptTitle(title: string): string {
  const normalized = title.trim();
  if (normalized === "") {
    throw new Error("Title must not be empty.");
  }
  return normalized;
}

export function cloneOutline(outline: ManuscriptOutline): ManuscriptOutline {
  return {
    version: 1,
    rootId: MANUSCRIPT_ROOT_ID,
    nodes: Object.fromEntries(
      Object.entries(outline.nodes).map(([id, node]) => [
        id,
        node.type === "folder" ? { ...node, children: [...node.children] } : { ...node },
      ]),
    ),
  };
}

export function parseOutline(content: string): ManuscriptOutline {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Manuscript outline is not valid JSON.");
  }
  return validateOutline(parsed);
}

export function validateOutline(value: unknown): ManuscriptOutline {
  if (typeof value !== "object" || value === null) {
    throw new Error("Manuscript outline must be an object.");
  }
  const outline = value as Partial<ManuscriptOutline>;
  if (outline.version !== 1) {
    throw new Error("Unsupported manuscript outline version.");
  }
  if (outline.rootId !== MANUSCRIPT_ROOT_ID) {
    throw new Error("Manuscript outline rootId must be root.");
  }
  if (typeof outline.nodes !== "object" || outline.nodes === null) {
    throw new Error("Manuscript outline nodes must be an object.");
  }

  const nodes: Record<string, ManuscriptNode> = {};
  for (const [id, rawNode] of Object.entries(outline.nodes as Record<string, unknown>)) {
    if (id !== MANUSCRIPT_ROOT_ID) {
      assertValidManuscriptId(id);
    }
    if (typeof rawNode !== "object" || rawNode === null) {
      throw new Error(`Invalid manuscript node: ${id}`);
    }
    const node = rawNode as Partial<ManuscriptNode>;
    if (node.id !== id) {
      throw new Error(`Manuscript node id mismatch: ${id}`);
    }
    if (typeof node.title !== "string" || node.title.trim() === "") {
      throw new Error(`Manuscript node title must not be empty: ${id}`);
    }
    if (node.type === "folder") {
      const children = (node as Partial<ManuscriptFolderNode>).children;
      if (!Array.isArray(children) || children.some((child) => typeof child !== "string")) {
        throw new Error(`Manuscript folder children must be string IDs: ${id}`);
      }
      nodes[id] = { id, type: "folder", title: node.title, children: [...children] };
    } else if (node.type === "chapter") {
      if ("children" in node) {
        throw new Error(`Manuscript chapter must be a leaf node: ${id}`);
      }
      nodes[id] = { id, type: "chapter", title: node.title };
    } else {
      throw new Error(`Invalid manuscript node type: ${id}`);
    }
  }

  const root = nodes[MANUSCRIPT_ROOT_ID];
  if (root === undefined || root.type !== "folder") {
    throw new Error("Manuscript outline root folder is missing.");
  }

  const parentById = new Map<string, string>();
  for (const node of Object.values(nodes)) {
    if (node.type !== "folder") {
      continue;
    }
    const seenChildren = new Set<string>();
    for (const childId of node.children) {
      if (seenChildren.has(childId)) {
        throw new Error(`Manuscript folder contains duplicate child: ${childId}`);
      }
      seenChildren.add(childId);
      if (nodes[childId] === undefined) {
        throw new Error(`Manuscript child does not exist: ${childId}`);
      }
      if (childId === MANUSCRIPT_ROOT_ID) {
        throw new Error("Manuscript root cannot be a child node.");
      }
      if (parentById.has(childId)) {
        throw new Error(`Manuscript node has multiple parents: ${childId}`);
      }
      parentById.set(childId, node.id);
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): void => {
    if (visited.has(id)) {
      return;
    }
    if (visiting.has(id)) {
      throw new Error(`Manuscript outline contains a cycle at: ${id}`);
    }
    visiting.add(id);
    const node = nodes[id];
    if (node?.type === "folder") {
      for (const childId of node.children) {
        visit(childId);
      }
    }
    visiting.delete(id);
    visited.add(id);
  };
  visit(MANUSCRIPT_ROOT_ID);
  if (visited.size !== Object.keys(nodes).length) {
    throw new Error("Manuscript outline contains unreachable nodes.");
  }

  return { version: 1, rootId: MANUSCRIPT_ROOT_ID, nodes };
}

export function clampChildIndex(index: number | undefined, length: number): number {
  if (index === undefined || !Number.isFinite(index)) {
    return length;
  }
  return Math.max(0, Math.min(length, Math.trunc(index)));
}

export function findParentId(outline: ManuscriptOutline, id: string): string | null {
  for (const node of Object.values(outline.nodes)) {
    if (node.type === "folder" && node.children.includes(id)) {
      return node.id;
    }
  }
  return null;
}

export function collectDescendantIds(outline: ManuscriptOutline, id: string): string[] {
  const node = outline.nodes[id];
  if (node === undefined || node.type === "chapter") {
    return [];
  }
  const descendants: string[] = [];
  for (const childId of node.children) {
    descendants.push(childId, ...collectDescendantIds(outline, childId));
  }
  return descendants;
}

export function cloneNode(node: ManuscriptNode): ManuscriptNode {
  return node.type === "folder" ? { ...node, children: [...node.children] } : { ...node };
}

export function collectSubtreeIds(outline: ManuscriptOutline, id: string): string[] {
  return [id, ...collectDescendantIds(outline, id)];
}

export function isChapterNode(node: ManuscriptNode): node is ManuscriptChapterNode {
  return node.type === "chapter";
}
