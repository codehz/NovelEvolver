import type { WorktreeSearchHit } from "#shared/rpc/worktree-search-rpc";

export type SearchPathTreeFolder = {
  type: "folder";
  segment: string;
  pathKey: string;
  children: SearchPathTreeNode[];
};

export type SearchPathTreeLeaf = {
  type: "leaf";
  nodeId: string;
  name: string;
  label: string;
  entityKind: WorktreeSearchHit["entityKind"];
  hits: WorktreeSearchHit[];
};

export type SearchPathTreeNode = SearchPathTreeFolder | SearchPathTreeLeaf;

function groupHitsByNodeId(hits: readonly WorktreeSearchHit[]): Map<string, WorktreeSearchHit[]> {
  const grouped = new Map<string, WorktreeSearchHit[]>();
  for (const hit of hits) {
    const list = grouped.get(hit.nodeId);
    if (list === undefined) {
      grouped.set(hit.nodeId, [hit]);
    } else {
      list.push(hit);
    }
  }
  return grouped;
}

function sortTreeNodes(nodes: SearchPathTreeNode[]): SearchPathTreeNode[] {
  return [...nodes].sort((left, right) => {
    if (left.type === right.type) {
      const leftName = left.type === "folder" ? left.segment : left.name;
      const rightName = right.type === "folder" ? right.segment : right.name;
      return leftName.localeCompare(rightName);
    }
    return left.type === "folder" ? -1 : 1;
  });
}

function sortTreeRecursive(nodes: SearchPathTreeNode[]): SearchPathTreeNode[] {
  return sortTreeNodes(nodes).map((node) => {
    if (node.type === "folder") {
      return { ...node, children: sortTreeRecursive(node.children) };
    }
    return node;
  });
}

function findFolderChild(
  parent: SearchPathTreeFolder,
  segment: string,
): SearchPathTreeFolder | undefined {
  const existing = parent.children.find(
    (child): child is SearchPathTreeFolder => child.type === "folder" && child.segment === segment,
  );
  return existing;
}

function ensureFolderAtPath(
  root: SearchPathTreeFolder,
  segments: readonly string[],
): SearchPathTreeFolder | undefined {
  if (segments.length === 0) {
    return undefined;
  }

  let current = root;
  let pathKey = "";
  for (const segment of segments) {
    pathKey = pathKey === "" ? segment : `${pathKey}/${segment}`;
    const existing = findFolderChild(current, segment);
    if (existing !== undefined) {
      current = existing;
      continue;
    }
    const folder: SearchPathTreeFolder = {
      type: "folder",
      segment,
      pathKey,
      children: [],
    };
    current.children.push(folder);
    current = folder;
  }
  return current;
}

function insertLeaf(
  root: SearchPathTreeFolder,
  displayPath: string,
  leaf: Omit<SearchPathTreeLeaf, "type">,
): void {
  const segments = displayPath.split("/").filter((segment) => segment !== "");
  if (segments.length === 0) {
    root.children.push({ type: "leaf", ...leaf, name: leaf.label });
    return;
  }

  const parentSegments = segments.slice(0, -1);
  const parent = parentSegments.length === 0 ? root : ensureFolderAtPath(root, parentSegments);
  if (parent === undefined) {
    return;
  }

  const fileName = segments[segments.length - 1] ?? leaf.label;
  parent.children.push({ type: "leaf", ...leaf, name: fileName });
}

export function buildSearchPathTree(hits: readonly WorktreeSearchHit[]): SearchPathTreeNode[] {
  const root: SearchPathTreeFolder = {
    type: "folder",
    segment: "",
    pathKey: "",
    children: [],
  };

  for (const [nodeId, nodeHits] of groupHitsByNodeId(hits)) {
    const first = nodeHits[0];
    if (first === undefined) {
      continue;
    }
    insertLeaf(root, first.displayPath, {
      nodeId,
      name: first.label,
      label: first.label,
      entityKind: first.entityKind,
      hits: nodeHits,
    });
  }

  return sortTreeRecursive(root.children);
}
