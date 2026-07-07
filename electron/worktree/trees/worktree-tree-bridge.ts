import { normalizeResourceNameInput } from "#shared/resource-library-path";
import type {
  FileChangeStatus,
  ManuscriptTreeNode,
  ManuscriptTreeSnapshot,
  ResourceTreeSnapshot,
} from "#shared/rpc/worktree-tree-rpc";

import { createEmptyOutline, validateOutline } from "../manuscript/outline";
import type { ResourceSnapshotEntry, ResourceSnapshotState } from "../resource-snapshot-state";
import { assertValidResourceRelativePath } from "../resources/paths";
import type { ManuscriptSnapshotState } from "../snapshot-state";

export function normalizeResourceNodeName(name: string): string {
  const normalized = normalizeResourceNameInput(name);
  if (normalized === "") {
    throw new Error("Name must not be empty.");
  }
  assertValidResourceRelativePath(normalized);
  if (normalized.includes("/")) {
    throw new Error("Name must not contain '/'.");
  }
  return normalized;
}

export function manuscriptTreeFromOutline(
  outline: ReturnType<typeof createEmptyOutline>,
): ManuscriptTreeSnapshot;
export function manuscriptTreeFromOutline(
  outline: ManuscriptSnapshotState["outline"],
): ManuscriptTreeSnapshot;
export function manuscriptTreeFromOutline(
  outline: ManuscriptSnapshotState["outline"],
): ManuscriptTreeSnapshot {
  const nodes: Record<string, ManuscriptTreeNode> = {};

  const visit = (id: string, parentId: string | null): void => {
    const node = outline.nodes[id];
    if (node === undefined) {
      throw new Error(`Missing manuscript node: ${id}`);
    }
    nodes[id] = {
      id,
      type: node.type,
      title: node.title,
      parentId,
      childIds: node.type === "folder" ? [...node.children] : [],
    };
    if (node.type === "folder") {
      for (const childId of node.children) {
        visit(childId, id);
      }
    }
  };

  visit(outline.rootId, null);
  return {
    rootId: outline.rootId,
    nodes,
  };
}

export function manuscriptTreeToOutline(snapshot: ManuscriptTreeSnapshot) {
  const nodes = Object.fromEntries(
    Object.entries(snapshot.nodes).map(([id, node]) => [
      id,
      node.type === "folder"
        ? {
            id,
            type: "folder" as const,
            title: node.title,
            children: [...node.childIds],
          }
        : {
            id,
            type: "chapter" as const,
            title: node.title,
          },
    ]),
  );
  return validateOutline({
    version: 1,
    rootId: snapshot.rootId,
    nodes,
  });
}

export function sortResourceChildrenByName(tree: ResourceTreeSnapshot, folderId: string): void {
  const folder = tree.nodes[folderId];
  if (folder === undefined || folder.type !== "folder") {
    return;
  }
  folder.childIds.sort((leftId, rightId) => {
    const left = tree.nodes[leftId];
    const right = tree.nodes[rightId];
    if (left === undefined || right === undefined) {
      return leftId.localeCompare(rightId);
    }
    if (left.type === right.type) {
      return left.name.localeCompare(right.name);
    }
    return left.type === "folder" ? -1 : 1;
  });
}

export function clearChangeStatuses<TNode extends { changeStatus?: FileChangeStatus }>(
  nodes: Record<string, TNode>,
): void {
  for (const node of Object.values(nodes)) {
    delete node.changeStatus;
  }
}

export function buildResourceSnapshotFromTree(
  tree: ResourceTreeSnapshot,
  readContent: (id: string) => string,
): {
  snapshot: ResourceSnapshotState;
  pathById: Map<string, string>;
  idByPath: Map<string, string>;
} {
  const entries = new Map<string, ResourceSnapshotEntry>();
  const pathById = new Map<string, string>([[tree.rootId, ""]]);
  const idByPath = new Map<string, string>([["", tree.rootId]]);
  let order = 0;

  const visit = (parentId: string, parentPath: string, depth: number): void => {
    const parent = tree.nodes[parentId];
    if (parent?.type !== "folder") {
      return;
    }
    parent.childIds.forEach((childId, index) => {
      const child = tree.nodes[childId];
      if (child === undefined) {
        throw new Error(`Missing resource node: ${childId}`);
      }
      const displayPath = parentPath === "" ? child.name : `${parentPath}/${child.name}`;
      pathById.set(child.id, displayPath);
      idByPath.set(displayPath, child.id);
      entries.set(child.id, {
        id: child.id,
        type: child.type,
        name: child.name,
        parentId,
        index,
        depth,
        displayPath,
        order,
        content: child.type === "file" ? readContent(child.id) : "",
      });
      order += 1;
      if (child.type === "folder") {
        visit(child.id, displayPath, depth + 1);
      }
    });
  };

  visit(tree.rootId, "", 0);
  return {
    snapshot: { entries },
    pathById,
    idByPath,
  };
}

export function sortedEntryValues<T extends { order: number }>(entries: Map<string, T>): T[] {
  return [...entries.values()].sort((left, right) => left.order - right.order);
}
