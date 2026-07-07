import type { Change } from "#shared/rpc/worktree-changes-rpc";

export type ChangeTreeFolderNode = {
  type: "folder";
  segment: string;
  pathKey: string;
  selfChanges: Change[];
  children: ChangeTreeNode[];
};

export type ChangeTreeLeafNode = {
  type: "leaf";
  item: Change;
};

export type ChangeTreeNode = ChangeTreeFolderNode | ChangeTreeLeafNode;

export type ChangeDomainRoot = {
  id: "manuscript" | "resource";
  title: string;
  iconClass: string;
  nodes: ChangeTreeNode[];
};

export type ChangeFlatRow =
  | {
      kind: "domain";
      key: string;
      title: string;
      iconClass: string;
      depth: number;
      expanded: boolean;
      childCount: number;
    }
  | {
      kind: "folder";
      key: string;
      node: ChangeTreeFolderNode;
      depth: number;
      expanded: boolean;
      childCount: number;
      inlineChange: Change | null;
    }
  | {
      kind: "change";
      key: string;
      item: Change;
      depth: number;
    };

function scopeKey(scope: string, key: string): string {
  return `${scope}::${key}`;
}

function sortTreeNodes(nodes: ChangeTreeNode[]): ChangeTreeNode[] {
  return [...nodes].sort((left, right) => {
    if (left.type === right.type) {
      if (left.type === "folder" && right.type === "folder") {
        return left.segment.localeCompare(right.segment);
      }
      if (left.type === "leaf" && right.type === "leaf") {
        return (
          left.item.displayPath.localeCompare(right.item.displayPath) ||
          left.item.id.localeCompare(right.item.id)
        );
      }
    }
    return left.type === "folder" ? -1 : 1;
  });
}

function sortTreeRecursive(nodes: ChangeTreeNode[]): ChangeTreeNode[] {
  return sortTreeNodes(nodes).map((node) => {
    if (node.type === "folder") {
      return {
        ...node,
        children: sortTreeRecursive(node.children),
      };
    }
    return node;
  });
}

function findFolderChild(
  parent: ChangeTreeFolderNode,
  segment: string,
): ChangeTreeFolderNode | undefined {
  const existing = parent.children.find(
    (child): child is ChangeTreeFolderNode => child.type === "folder" && child.segment === segment,
  );
  return existing;
}

function ensureFolderAtPath(
  root: ChangeTreeFolderNode,
  segments: readonly string[],
): ChangeTreeFolderNode | undefined {
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
    const folder: ChangeTreeFolderNode = {
      type: "folder",
      segment,
      pathKey,
      selfChanges: [],
      children: [],
    };
    current.children.push(folder);
    current = folder;
  }
  return current;
}

function insertChange(root: ChangeTreeFolderNode, change: Change): void {
  const segments = change.displayPath.split("/").filter((segment) => segment !== "");

  if (change.entityKind === "folder") {
    const folder = ensureFolderAtPath(root, segments);
    if (folder !== undefined) {
      folder.selfChanges.push(change);
    }
    return;
  }

  if (segments.length === 0) {
    root.children.push({ type: "leaf", item: change });
    return;
  }

  const parentSegments = segments.slice(0, -1);
  const parent = parentSegments.length === 0 ? root : ensureFolderAtPath(root, parentSegments);
  if (parent === undefined) {
    return;
  }
  parent.children.push({ type: "leaf", item: change });
}

export function buildChangeTree(changes: readonly Change[]): ChangeTreeNode[] {
  const root: ChangeTreeFolderNode = {
    type: "folder",
    segment: "",
    pathKey: "",
    selfChanges: [],
    children: [],
  };

  for (const change of changes) {
    insertChange(root, change);
  }

  return sortTreeRecursive(root.children);
}

function folderChildCount(node: ChangeTreeFolderNode): number {
  return node.children.length + (node.selfChanges.length > 1 ? node.selfChanges.length : 0);
}

function visitNodes(
  nodes: readonly ChangeTreeNode[],
  scope: string,
  depth: number,
  expandedFolders: ReadonlySet<string>,
  out: ChangeFlatRow[],
): void {
  for (const node of nodes) {
    if (node.type === "folder") {
      const key = scopeKey(scope, node.pathKey);
      const childCount = folderChildCount(node);
      const inlineChange = node.selfChanges.length === 1 ? node.selfChanges[0]! : null;
      const expanded = expandedFolders.has(key);
      out.push({
        kind: "folder",
        key,
        node,
        depth,
        expanded,
        childCount,
        inlineChange,
      });
      if (childCount > 0 && expanded) {
        if (node.selfChanges.length > 1) {
          for (const item of node.selfChanges) {
            out.push({
              kind: "change",
              key: `change:${item.id}`,
              item,
              depth: depth + 1,
            });
          }
        }
        visitNodes(node.children, scope, depth + 1, expandedFolders, out);
      }
      continue;
    }

    out.push({
      kind: "change",
      key: `change:${node.item.id}`,
      item: node.item,
      depth,
    });
  }
}

export function flattenChangeTree(
  roots: readonly ChangeDomainRoot[],
  expandedDomains: ReadonlySet<string>,
  expandedFolders: ReadonlySet<string>,
): ChangeFlatRow[] {
  const rows: ChangeFlatRow[] = [];
  for (const root of roots) {
    const expanded = expandedDomains.has(root.id);
    rows.push({
      kind: "domain",
      key: root.id,
      title: root.title,
      iconClass: root.iconClass,
      depth: 0,
      expanded,
      childCount: root.nodes.length,
    });
    if (expanded) {
      visitNodes(root.nodes, root.id, 1, expandedFolders, rows);
    }
  }
  return rows;
}

export function collectChangeTreeFolderKeys(roots: readonly ChangeDomainRoot[]): string[] {
  const keys: string[] = [];
  const visit = (nodes: readonly ChangeTreeNode[], scope: string) => {
    for (const node of nodes) {
      if (node.type !== "folder") {
        continue;
      }
      if (folderChildCount(node) > 0) {
        keys.push(scopeKey(scope, node.pathKey));
      }
      visit(node.children, scope);
    }
  };
  for (const root of roots) {
    visit(root.nodes, root.id);
  }
  return keys;
}
