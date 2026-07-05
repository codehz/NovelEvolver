import type { WorktreeSearchHit } from "#shared/rpc/worktree-search";

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

  let current = root;
  let pathKey = "";
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index]!;
    pathKey = pathKey === "" ? segment : `${pathKey}/${segment}`;
    const existing = current.children.find(
      (child): child is SearchPathTreeFolder =>
        child.type === "folder" && child.segment === segment,
    );
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

  const fileName = segments[segments.length - 1] ?? leaf.label;
  current.children.push({ type: "leaf", ...leaf, name: fileName });
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
