import type { ScmChange } from "#shared/rpc/worktree-scm";

export type ScmChangeTreeFolderNode = {
  type: "folder";
  segment: string;
  pathKey: string;
  selfChanges: ScmChange[];
  children: ScmChangeTreeNode[];
};

export type ScmChangeTreeLeafNode = {
  type: "leaf";
  item: ScmChange;
};

export type ScmChangeTreeNode = ScmChangeTreeFolderNode | ScmChangeTreeLeafNode;

export type ScmChangeDomainRoot = {
  id: "manuscript" | "resource";
  title: string;
  iconClass: string;
  nodes: ScmChangeTreeNode[];
};

export type ScmChangeFlatRow =
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
      node: ScmChangeTreeFolderNode;
      depth: number;
      expanded: boolean;
      childCount: number;
      inlineChange: ScmChange | null;
    }
  | {
      kind: "change";
      key: string;
      item: ScmChange;
      depth: number;
    };

function scopeKey(scope: string, key: string): string {
  return `${scope}::${key}`;
}

function sortTreeNodes(nodes: ScmChangeTreeNode[]): ScmChangeTreeNode[] {
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

function sortTreeRecursive(nodes: ScmChangeTreeNode[]): ScmChangeTreeNode[] {
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
  parent: ScmChangeTreeFolderNode,
  segment: string,
): ScmChangeTreeFolderNode | undefined {
  const existing = parent.children.find(
    (child): child is ScmChangeTreeFolderNode =>
      child.type === "folder" && child.segment === segment,
  );
  return existing;
}

function ensureFolderAtPath(
  root: ScmChangeTreeFolderNode,
  segments: readonly string[],
): ScmChangeTreeFolderNode | undefined {
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
    const folder: ScmChangeTreeFolderNode = {
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

function insertChange(root: ScmChangeTreeFolderNode, change: ScmChange): void {
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

export function buildScmChangeTree(changes: readonly ScmChange[]): ScmChangeTreeNode[] {
  const root: ScmChangeTreeFolderNode = {
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

function folderChildCount(node: ScmChangeTreeFolderNode): number {
  return node.children.length + (node.selfChanges.length > 1 ? node.selfChanges.length : 0);
}

function visitNodes(
  nodes: readonly ScmChangeTreeNode[],
  scope: string,
  depth: number,
  expandedFolders: ReadonlySet<string>,
  out: ScmChangeFlatRow[],
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

export function flattenScmChangeTree(
  roots: readonly ScmChangeDomainRoot[],
  expandedDomains: ReadonlySet<string>,
  expandedFolders: ReadonlySet<string>,
): ScmChangeFlatRow[] {
  const rows: ScmChangeFlatRow[] = [];
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

export function collectScmTreeFolderKeys(roots: readonly ScmChangeDomainRoot[]): string[] {
  const keys: string[] = [];
  const visit = (nodes: readonly ScmChangeTreeNode[], scope: string) => {
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
