import type {
  ManuscriptChapterNode,
  ManuscriptNode,
  ManuscriptOutline,
} from "@novelevolver/domain/worktree";
import { validateOutline } from "@novelevolver/domain/worktree";

export { validateOutline } from "@novelevolver/domain/worktree";

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
