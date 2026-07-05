import type { WorktreeSearchHit } from "#shared/rpc/worktree-search";

import type { SearchPathTreeLeaf, SearchPathTreeNode } from "./build-search-path-tree";

export type SearchResultDomainRoot = {
  id: string;
  title: string;
  iconClass: string;
  nodes: SearchPathTreeNode[];
};

function scopeKey(scope: string, key: string): string {
  return `${scope}::${key}`;
}

export type SearchResultFlatRow =
  | {
      kind: "domain";
      key: string;
      title: string;
      iconClass: string;
      depth: number;
      expanded: boolean;
    }
  | {
      kind: "folder";
      key: string;
      segment: string;
      depth: number;
      expanded: boolean;
      childCount: number;
    }
  | {
      kind: "leaf";
      key: string;
      leaf: SearchPathTreeLeaf;
      depth: number;
      expanded: boolean;
      showMatches: boolean;
    }
  | {
      kind: "match";
      key: string;
      hit: WorktreeSearchHit;
      leafDepth: number;
    };

function leafShowsMatches(leaf: SearchPathTreeLeaf): boolean {
  return leaf.hits.length > 1;
}

function visitNodes(
  nodes: SearchPathTreeNode[],
  scope: string,
  depth: number,
  expandedFolders: ReadonlySet<string>,
  expandedLeaves: ReadonlySet<string>,
  out: SearchResultFlatRow[],
): void {
  for (const node of nodes) {
    if (node.type === "folder") {
      const key = scopeKey(scope, node.pathKey);
      const expanded = expandedFolders.has(key);
      out.push({
        kind: "folder",
        key,
        segment: node.segment,
        depth,
        expanded,
        childCount: node.children.length,
      });
      if (expanded) {
        visitNodes(node.children, scope, depth + 1, expandedFolders, expandedLeaves, out);
      }
      continue;
    }

    const key = scopeKey(scope, node.nodeId);
    const showMatches = leafShowsMatches(node);
    const expanded = expandedLeaves.has(key);
    out.push({
      kind: "leaf",
      key,
      leaf: node,
      depth,
      expanded,
      showMatches,
    });
    if (showMatches && expanded) {
      for (const [index, hit] of node.hits.entries()) {
        out.push({
          kind: "match",
          key: `${key}::${hit.line}:${hit.column}:${index}`,
          hit,
          leafDepth: depth,
        });
      }
    }
  }
}

export function flattenSearchResultTree(
  roots: readonly SearchResultDomainRoot[],
  expandedDomains: ReadonlySet<string>,
  expandedFolders: ReadonlySet<string>,
  expandedLeaves: ReadonlySet<string>,
): SearchResultFlatRow[] {
  const rows: SearchResultFlatRow[] = [];
  for (const root of roots) {
    const domainKey = root.id;
    const domainExpanded = expandedDomains.has(domainKey);
    rows.push({
      kind: "domain",
      key: domainKey,
      title: root.title,
      iconClass: root.iconClass,
      depth: 0,
      expanded: domainExpanded,
    });
    if (domainExpanded) {
      visitNodes(root.nodes, root.id, 1, expandedFolders, expandedLeaves, rows);
    }
  }
  return rows;
}

export function collectSearchTreeFolderKeys(roots: readonly SearchResultDomainRoot[]): string[] {
  const keys: string[] = [];
  const visit = (nodes: SearchPathTreeNode[], scope: string) => {
    for (const node of nodes) {
      if (node.type === "folder") {
        keys.push(scopeKey(scope, node.pathKey));
        visit(node.children, scope);
      }
    }
  };
  for (const root of roots) {
    visit(root.nodes, root.id);
  }
  return keys;
}

export function collectSearchTreeLeafKeys(roots: readonly SearchResultDomainRoot[]): string[] {
  const keys: string[] = [];
  const visit = (nodes: SearchPathTreeNode[], scope: string) => {
    for (const node of nodes) {
      if (node.type === "leaf") {
        if (leafShowsMatches(node)) {
          keys.push(scopeKey(scope, node.nodeId));
        }
      } else {
        visit(node.children, scope);
      }
    }
  };
  for (const root of roots) {
    visit(root.nodes, root.id);
  }
  return keys;
}
