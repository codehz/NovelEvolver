import { useCallback, useEffect, useMemo, useState } from "react";

import { ScrollArea } from "#app/components/ScrollArea";
import { cn } from "#app/lib/cn";
import {
  getTreeRowPaddingLeft,
  TREE_ROW_CONTENT_GAP_PX,
  TREE_ROW_DISCLOSURE_WIDTH_PX,
} from "#app/pages/ProjectWorkbench/tree/tree-row-motion";
import type { WorktreeSearchHit } from "#shared/rpc/worktree-search";

import type { SearchPathTreeLeaf, SearchPathTreeNode } from "./build-search-path-tree";

const SEARCH_TREE_EXTRA_LEFT_PX = 6;

function searchTreePaddingLeft(depth: number): number {
  return getTreeRowPaddingLeft(depth) + SEARCH_TREE_EXTRA_LEFT_PX;
}

/** 匹配预览行无展开箭头，用与父行箭头槽位等宽的额外缩进对齐内容列。 */
function searchTreeMatchPaddingLeft(leafDepth: number): number {
  return searchTreePaddingLeft(leafDepth) + TREE_ROW_DISCLOSURE_WIDTH_PX + TREE_ROW_CONTENT_GAP_PX;
}

export type SearchResultDomainRoot = {
  id: string;
  title: string;
  iconClass: string;
  nodes: SearchPathTreeNode[];
};

function scopeKey(scope: string, key: string): string {
  return `${scope}::${key}`;
}

function collectFolderPathKeys(nodes: SearchPathTreeNode[], scope: string): string[] {
  const keys: string[] = [];
  const visit = (list: SearchPathTreeNode[]) => {
    for (const node of list) {
      if (node.type === "folder") {
        keys.push(scopeKey(scope, node.pathKey));
        visit(node.children);
      }
    }
  };
  visit(nodes);
  return keys;
}

function collectLeafIds(nodes: SearchPathTreeNode[], scope: string): string[] {
  const ids: string[] = [];
  const visit = (list: SearchPathTreeNode[]) => {
    for (const node of list) {
      if (node.type === "leaf") {
        ids.push(scopeKey(scope, node.nodeId));
      } else {
        visit(node.children);
      }
    }
  };
  visit(nodes);
  return ids;
}

function entityIconClass(entityKind: WorktreeSearchHit["entityKind"]): string {
  return cn(
    entityKind === "folder" && "icon-[codicon--folder] text-ctp-mauve",
    entityKind === "chapter" && "icon-[codicon--book] text-ctp-blue",
    entityKind === "file" && "icon-[codicon--file] text-ctp-overlay0",
  );
}

function SearchMatchRow({
  hit,
  depth,
  onOpen,
}: {
  hit: WorktreeSearchHit;
  depth: number;
  onOpen: (hit: WorktreeSearchHit) => void;
}) {
  const openable =
    (hit.domain === "manuscript" && hit.entityKind === "chapter") ||
    (hit.domain === "resource" && hit.entityKind === "file");

  return (
    <li
      role="treeitem"
      className={cn(
        "flex min-h-6 cursor-default items-center gap-1 py-0.5 pr-2 text-2xs text-ctp-subtext1",
        openable && "cursor-pointer hover:bg-ctp-surface0/50",
      )}
      style={{ paddingLeft: `${searchTreeMatchPaddingLeft(depth)}px` }}
      onClick={() => {
        if (openable) {
          onOpen(hit);
        }
      }}
      onKeyDown={(event) => {
        if (!openable) {
          return;
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(hit);
        }
      }}
      tabIndex={openable ? 0 : -1}
    >
      <span className="icon-[codicon--list-flat] shrink-0 text-sm text-ctp-overlay0" />
      {hit.matchKind === "title" ? (
        <span className="truncate text-ctp-subtext0">名称匹配</span>
      ) : (
        <span className="truncate font-mono text-ctp-text">
          {hit.line !== undefined ? (
            <span className="mr-1 text-ctp-overlay0">{hit.line}:</span>
          ) : null}
          {hit.snippet ?? hit.label}
        </span>
      )}
    </li>
  );
}

function SearchLeafRow({
  leaf,
  depth,
  expanded,
  onToggle,
  onOpen,
}: {
  leaf: SearchPathTreeLeaf;
  depth: number;
  expanded: boolean;
  onToggle: () => void;
  onOpen: (hit: WorktreeSearchHit) => void;
}) {
  const showMatches = leaf.hits.length > 1 || leaf.hits.some((hit) => hit.matchKind === "content");
  const openable =
    (leaf.hits[0]?.domain === "manuscript" && leaf.entityKind === "chapter") ||
    (leaf.hits[0]?.domain === "resource" && leaf.entityKind === "file");

  const openPrimary = () => {
    const primary = leaf.hits.find((hit) => hit.matchKind === "content") ?? leaf.hits[0];
    if (primary !== undefined) {
      onOpen(primary);
    }
  };

  return (
    <>
      <li
        role="treeitem"
        aria-expanded={showMatches ? expanded : undefined}
        className={cn(
          "flex h-6 items-center gap-1 pr-2 text-xs text-ctp-subtext1",
          openable && "cursor-pointer hover:bg-ctp-surface0/50",
        )}
        style={{ paddingLeft: `${searchTreePaddingLeft(depth)}px` }}
        onClick={() => {
          if (showMatches) {
            onToggle();
            return;
          }
          if (openable) {
            openPrimary();
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (showMatches) {
              onToggle();
            } else if (openable) {
              openPrimary();
            }
          }
        }}
        tabIndex={0}
      >
        {showMatches ? (
          <span
            className={cn(
              "shrink-0 text-sm text-ctp-overlay0",
              expanded ? "icon-[codicon--chevron-down]" : "icon-[codicon--chevron-right]",
            )}
          />
        ) : (
          <span className="size-3.5 shrink-0" />
        )}
        <span className={cn(entityIconClass(leaf.entityKind), "shrink-0 text-sm")} />
        <span className="truncate">{leaf.name}</span>
        {showMatches ? (
          <span className="ml-auto shrink-0 rounded bg-ctp-surface0 px-1 py-px font-mono text-[10px] text-ctp-subtext0">
            {leaf.hits.length}
          </span>
        ) : null}
      </li>
      {showMatches && expanded
        ? leaf.hits.map((hit, index) => (
            <SearchMatchRow
              key={`${leaf.nodeId}-${hit.matchKind}-${hit.line ?? index}`}
              hit={hit}
              depth={depth}
              onOpen={onOpen}
            />
          ))
        : null}
    </>
  );
}

function SearchDomainRootRow({
  title,
  iconClass,
  depth,
  expanded,
  onToggle,
}: {
  title: string;
  iconClass: string;
  depth: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <li
      role="treeitem"
      aria-expanded={expanded}
      className="flex h-6 cursor-pointer items-center gap-1 pr-2 text-xs font-medium text-ctp-text hover:bg-ctp-surface0/50"
      style={{ paddingLeft: `${searchTreePaddingLeft(depth)}px` }}
      onClick={onToggle}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggle();
        }
      }}
      tabIndex={0}
    >
      <span
        className={cn(
          "shrink-0 text-sm text-ctp-overlay0",
          expanded ? "icon-[codicon--chevron-down]" : "icon-[codicon--chevron-right]",
        )}
      />
      <span className={cn(iconClass, "shrink-0 text-sm")} />
      <span className="truncate">{title}</span>
    </li>
  );
}

function SearchFolderRow({
  segment,
  depth,
  expanded,
  childCount,
  onToggle,
}: {
  segment: string;
  depth: number;
  expanded: boolean;
  childCount: number;
  onToggle: () => void;
}) {
  return (
    <li
      role="treeitem"
      aria-expanded={expanded}
      className="flex h-6 cursor-pointer items-center gap-1 pr-2 text-xs text-ctp-subtext1 hover:bg-ctp-surface0/50"
      style={{ paddingLeft: `${searchTreePaddingLeft(depth)}px` }}
      onClick={onToggle}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggle();
        }
      }}
      tabIndex={0}
    >
      <span
        className={cn(
          "shrink-0 text-sm text-ctp-overlay0",
          expanded ? "icon-[codicon--chevron-down]" : "icon-[codicon--chevron-right]",
        )}
      />
      <span className="icon-[codicon--folder] shrink-0 text-sm text-ctp-mauve" />
      <span className="truncate">{segment}</span>
      <span className="ml-auto shrink-0 text-[10px] text-ctp-overlay0">{childCount}</span>
    </li>
  );
}

function SearchTreeNodes({
  nodes,
  depth,
  scope,
  expandedFolders,
  expandedLeaves,
  onToggleFolder,
  onToggleLeaf,
  onOpen,
}: {
  nodes: SearchPathTreeNode[];
  depth: number;
  scope: string;
  expandedFolders: ReadonlySet<string>;
  expandedLeaves: ReadonlySet<string>;
  onToggleFolder: (scopedPathKey: string) => void;
  onToggleLeaf: (scopedNodeId: string) => void;
  onOpen: (hit: WorktreeSearchHit) => void;
}) {
  return (
    <>
      {nodes.map((node) => {
        if (node.type === "folder") {
          const scopedPathKey = scopeKey(scope, node.pathKey);
          const expanded = expandedFolders.has(scopedPathKey);
          return (
            <div key={scopedPathKey}>
              <SearchFolderRow
                segment={node.segment}
                depth={depth}
                expanded={expanded}
                childCount={node.children.length}
                onToggle={() => onToggleFolder(scopedPathKey)}
              />
              {expanded ? (
                <SearchTreeNodes
                  nodes={node.children}
                  depth={depth + 1}
                  scope={scope}
                  expandedFolders={expandedFolders}
                  expandedLeaves={expandedLeaves}
                  onToggleFolder={onToggleFolder}
                  onToggleLeaf={onToggleLeaf}
                  onOpen={onOpen}
                />
              ) : null}
            </div>
          );
        }

        const scopedNodeId = scopeKey(scope, node.nodeId);
        const expanded = expandedLeaves.has(scopedNodeId);
        return (
          <SearchLeafRow
            key={scopedNodeId}
            leaf={node}
            depth={depth}
            expanded={expanded}
            onToggle={() => onToggleLeaf(scopedNodeId)}
            onOpen={onOpen}
          />
        );
      })}
    </>
  );
}

export function SearchResultTree({
  roots,
  onOpenHit,
}: {
  roots: SearchResultDomainRoot[];
  onOpenHit: (hit: WorktreeSearchHit) => void;
}) {
  const folderKeys = useMemo(() => {
    const keys: string[] = [];
    for (const root of roots) {
      keys.push(...collectFolderPathKeys(root.nodes, root.id));
    }
    return keys;
  }, [roots]);

  const leafIds = useMemo(() => {
    const ids: string[] = [];
    for (const root of roots) {
      ids.push(...collectLeafIds(root.nodes, root.id));
    }
    return ids;
  }, [roots]);

  const domainIds = useMemo(() => roots.map((root) => root.id), [roots]);

  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(() => new Set(domainIds));
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set(folderKeys));
  const [expandedLeaves, setExpandedLeaves] = useState<Set<string>>(() => new Set(leafIds));

  useEffect(() => {
    setExpandedDomains(new Set(domainIds));
    setExpandedFolders(new Set(folderKeys));
    setExpandedLeaves(new Set(leafIds));
  }, [domainIds, folderKeys, leafIds]);

  const onToggleDomain = useCallback((domainId: string) => {
    setExpandedDomains((current) => {
      const next = new Set(current);
      if (next.has(domainId)) {
        next.delete(domainId);
      } else {
        next.add(domainId);
      }
      return next;
    });
  }, []);

  const onToggleFolder = useCallback((pathKey: string) => {
    setExpandedFolders((current) => {
      const next = new Set(current);
      if (next.has(pathKey)) {
        next.delete(pathKey);
      } else {
        next.add(pathKey);
      }
      return next;
    });
  }, []);

  const onToggleLeaf = useCallback((nodeId: string) => {
    setExpandedLeaves((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  return (
    <ScrollArea className="min-h-0 flex-1" fill>
      <ul className="flex flex-col gap-0.5 py-1" role="tree">
        {roots.map((root) => {
          const domainExpanded = expandedDomains.has(root.id);
          return (
            <div key={root.id}>
              <SearchDomainRootRow
                title={root.title}
                iconClass={root.iconClass}
                depth={0}
                expanded={domainExpanded}
                onToggle={() => onToggleDomain(root.id)}
              />
              {domainExpanded ? (
                <SearchTreeNodes
                  nodes={root.nodes}
                  depth={1}
                  scope={root.id}
                  expandedFolders={expandedFolders}
                  expandedLeaves={expandedLeaves}
                  onToggleFolder={onToggleFolder}
                  onToggleLeaf={onToggleLeaf}
                  onOpen={onOpenHit}
                />
              ) : null}
            </div>
          );
        })}
      </ul>
    </ScrollArea>
  );
}
