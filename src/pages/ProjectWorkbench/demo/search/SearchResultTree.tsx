import { useCallback, useEffect, useMemo, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";

import { ScrollArea } from "#app/components/ScrollArea";
import { cn } from "#app/lib/cn";
import { FlatTreeList } from "#app/pages/ProjectWorkbench/tree/FlatTreeList";
import {
  getTreeRowPaddingLeft,
  TREE_ROW_CONTENT_GAP_PX,
  TREE_ROW_DISCLOSURE_WIDTH_PX,
  TREE_ROW_HEIGHT_PX,
  treeRowDisclosureChevronSlotClass,
  treeRowDisclosureSpacerClass,
} from "#app/pages/ProjectWorkbench/tree/tree-row-motion";
import { TreeMotionRow } from "#app/pages/ProjectWorkbench/tree/TreeMotionRow";
import type { WorktreeSearchHit } from "#shared/rpc/worktree-search";

import {
  collectSearchTreeFolderKeys,
  collectSearchTreeLeafKeys,
  flattenSearchResultTree,
  type SearchResultDomainRoot,
  type SearchResultFlatRow,
} from "./search-result-tree-projector";

export type { SearchResultDomainRoot };

const SEARCH_TREE_EXTRA_LEFT_PX = 6;

function searchTreePaddingLeft(depth: number): number {
  return getTreeRowPaddingLeft(depth) + SEARCH_TREE_EXTRA_LEFT_PX;
}

function searchTreeMatchPaddingLeft(leafDepth: number): number {
  return searchTreePaddingLeft(leafDepth) + TREE_ROW_DISCLOSURE_WIDTH_PX + TREE_ROW_CONTENT_GAP_PX;
}

function entityIconClass(entityKind: WorktreeSearchHit["entityKind"]): string {
  return cn(
    entityKind === "folder" && "icon-[codicon--folder] text-ctp-mauve",
    entityKind === "chapter" && "icon-[codicon--book] text-ctp-blue",
    entityKind === "file" && "icon-[codicon--file] text-ctp-overlay0",
  );
}

function disclosureChevron(expanded: boolean): ReactNode {
  return (
    <span
      aria-hidden="true"
      className={cn(
        treeRowDisclosureChevronSlotClass,
        "icon-[codicon--chevron-right]",
        "motion-safe:transition-transform motion-safe:duration-220 motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)]",
        expanded && "rotate-90",
      )}
    />
  );
}

function activateOnEnterSpace(onActivate: () => void) {
  return (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onActivate();
    }
  };
}

function SearchFlatRowView({
  row,
  layout,
  onToggleDomain,
  onToggleFolder,
  onToggleLeaf,
  onOpen,
}: {
  row: SearchResultFlatRow;
  layout: { y: number; height: number; animateEnter: boolean };
  onToggleDomain: (id: string) => void;
  onToggleFolder: (key: string) => void;
  onToggleLeaf: (key: string) => void;
  onOpen: (hit: WorktreeSearchHit) => void;
}) {
  const { y, height, animateEnter } = layout;

  if (row.kind === "domain") {
    return (
      <TreeMotionRow
        y={y}
        height={height}
        animateEnter={animateEnter}
        depth={row.depth}
        paddingLeftPx={searchTreePaddingLeft(row.depth)}
        className="cursor-pointer text-xs font-medium text-ctp-text hover:bg-ctp-surface0/50"
        aria-expanded={row.expanded}
        tabIndex={0}
        onClick={() => onToggleDomain(row.key)}
        onKeyDown={activateOnEnterSpace(() => onToggleDomain(row.key))}
      >
        {disclosureChevron(row.expanded)}
        <span className={cn(row.iconClass, "shrink-0 text-sm")} />
        <span className="truncate">{row.title}</span>
      </TreeMotionRow>
    );
  }

  if (row.kind === "folder") {
    return (
      <TreeMotionRow
        y={y}
        height={height}
        animateEnter={animateEnter}
        depth={row.depth}
        paddingLeftPx={searchTreePaddingLeft(row.depth)}
        className="cursor-pointer text-xs text-ctp-subtext1 hover:bg-ctp-surface0/50"
        aria-expanded={row.expanded}
        tabIndex={0}
        onClick={() => onToggleFolder(row.key)}
        onKeyDown={activateOnEnterSpace(() => onToggleFolder(row.key))}
      >
        {disclosureChevron(row.expanded)}
        <span className="icon-[codicon--folder] shrink-0 text-sm text-ctp-mauve" />
        <span className="truncate">{row.segment}</span>
        <span className="ml-auto shrink-0 text-[10px] text-ctp-overlay0">{row.childCount}</span>
      </TreeMotionRow>
    );
  }

  if (row.kind === "match") {
    const openable =
      (row.hit.domain === "manuscript" && row.hit.entityKind === "chapter") ||
      (row.hit.domain === "resource" && row.hit.entityKind === "file");

    return (
      <TreeMotionRow
        y={y}
        height={height}
        animateEnter={animateEnter}
        depth={row.leafDepth}
        paddingLeftPx={searchTreeMatchPaddingLeft(row.leafDepth)}
        className={cn(
          "text-2xs text-ctp-subtext1",
          openable && "cursor-pointer hover:bg-ctp-surface0/50",
        )}
        tabIndex={openable ? 0 : -1}
        onClick={() => {
          if (openable) {
            onOpen(row.hit);
          }
        }}
        onKeyDown={openable ? activateOnEnterSpace(() => onOpen(row.hit)) : undefined}
      >
        <span className="icon-[codicon--list-flat] shrink-0 text-sm text-ctp-overlay0" />
        {row.hit.matchKind === "title" ? (
          <span className="truncate text-ctp-subtext0">名称匹配</span>
        ) : (
          <span className="truncate font-mono text-ctp-text">
            {row.hit.line !== undefined ? (
              <span className="mr-1 text-ctp-overlay0">{row.hit.line}:</span>
            ) : null}
            {row.hit.snippet ?? row.hit.label}
          </span>
        )}
      </TreeMotionRow>
    );
  }

  const leaf = row.leaf;
  const openable =
    (leaf.hits[0]?.domain === "manuscript" && leaf.entityKind === "chapter") ||
    (leaf.hits[0]?.domain === "resource" && leaf.entityKind === "file");

  const openPrimary = () => {
    const primary = leaf.hits.find((hit) => hit.matchKind === "content") ?? leaf.hits[0];
    if (primary !== undefined) {
      onOpen(primary);
    }
  };

  const onActivate = () => {
    if (row.showMatches) {
      onToggleLeaf(row.key);
      return;
    }
    if (openable) {
      openPrimary();
    }
  };

  return (
    <TreeMotionRow
      y={y}
      height={height}
      animateEnter={animateEnter}
      depth={row.depth}
      paddingLeftPx={searchTreePaddingLeft(row.depth)}
      className={cn(
        "text-xs text-ctp-subtext1",
        openable && "cursor-pointer hover:bg-ctp-surface0/50",
      )}
      aria-expanded={row.showMatches ? row.expanded : undefined}
      tabIndex={0}
      onClick={onActivate}
      onKeyDown={activateOnEnterSpace(onActivate)}
    >
      {row.showMatches ? (
        disclosureChevron(row.expanded)
      ) : (
        <span className={treeRowDisclosureSpacerClass} />
      )}
      <span className={cn(entityIconClass(leaf.entityKind), "shrink-0 text-sm")} />
      <span className="truncate">{leaf.name}</span>
      {row.showMatches ? (
        <span className="ml-auto shrink-0 rounded bg-ctp-surface0 px-1 py-px font-mono text-[10px] text-ctp-subtext0">
          {leaf.hits.length}
        </span>
      ) : null}
    </TreeMotionRow>
  );
}

export function SearchResultTree({
  roots,
  onOpenHit,
}: {
  roots: SearchResultDomainRoot[];
  onOpenHit: (hit: WorktreeSearchHit) => void;
}) {
  const folderKeys = useMemo(() => collectSearchTreeFolderKeys(roots), [roots]);
  const leafIds = useMemo(() => collectSearchTreeLeafKeys(roots), [roots]);
  const domainIds = useMemo(() => roots.map((root) => root.id), [roots]);

  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(() => new Set(domainIds));
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set(folderKeys));
  const [expandedLeaves, setExpandedLeaves] = useState<Set<string>>(() => new Set(leafIds));

  useEffect(() => {
    setExpandedDomains(new Set(domainIds));
    setExpandedFolders(new Set(folderKeys));
    setExpandedLeaves(new Set(leafIds));
  }, [domainIds, folderKeys, leafIds]);

  const flatRows = useMemo(
    () => flattenSearchResultTree(roots, expandedDomains, expandedFolders, expandedLeaves),
    [roots, expandedDomains, expandedFolders, expandedLeaves],
  );

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

  const getItemKey = useCallback((row: SearchResultFlatRow) => row.key, []);

  return (
    <ScrollArea className="min-h-0 flex-1" fill>
      <div className="py-1">
        <FlatTreeList
          items={flatRows}
          getItemKey={getItemKey}
          rowHeight={TREE_ROW_HEIGHT_PX}
          className="w-full"
          renderRow={(row, _index, layout) => (
            <SearchFlatRowView
              row={row}
              layout={layout}
              onToggleDomain={onToggleDomain}
              onToggleFolder={onToggleFolder}
              onToggleLeaf={onToggleLeaf}
              onOpen={onOpenHit}
            />
          )}
        />
      </div>
    </ScrollArea>
  );
}
