import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";

import {
  contentEntityIconClass,
  contentFolderIconClass,
} from "#app/pages/ProjectWorkbench/workbench/tree/content-tree-icons";
import type { TreeRowLayout } from "#app/pages/ProjectWorkbench/workbench/tree/tree-row-layout";
import {
  getTreeRowPaddingLeft,
  TREE_ROW_CONTENT_GAP_PX,
  TREE_ROW_DISCLOSURE_WIDTH_PX,
  TREE_ROW_HEIGHT_PX,
  treeRowDisclosureSpacerClass,
} from "#app/pages/ProjectWorkbench/workbench/tree/tree-row-motion";
import { TreeBody, type TreeBodyStatus } from "#app/pages/ProjectWorkbench/workbench/tree/TreeBody";
import { TreeMotionRow } from "#app/pages/ProjectWorkbench/workbench/tree/TreeMotionRow";
import { cn } from "#app/shared/lib/ui/cn";
import { DisclosureChevron } from "#app/shared/ui/DisclosureChevron";
import type { WorktreeSearchHit } from "#shared/rpc/worktree-search-rpc";

import {
  collectSearchTreeFolderKeys,
  collectSearchTreeLeafKeys,
  flattenSearchResultTree,
  type SearchResultDomainRoot,
  type SearchResultFlatRow,
} from "./search-result-tree-projector";
import { useSearchResultHighlights } from "./use-search-result-highlights";

export type { SearchResultDomainRoot };

function searchTreeMatchPaddingLeft(leafDepth: number): number {
  return getTreeRowPaddingLeft(leafDepth) + TREE_ROW_DISCLOSURE_WIDTH_PX + TREE_ROW_CONTENT_GAP_PX;
}

const searchResultCountPillClass = cn(
  "ml-auto shrink-0 rounded-full bg-ctp-surface0 px-1 py-px font-mono text-[10px] text-ctp-subtext0",
);

function activateOnEnterSpace(onActivate: () => void) {
  return (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onActivate();
    }
  };
}

function SearchHighlightText({ children, className }: { children: string; className?: string }) {
  return (
    <span data-search-highlight className={className}>
      {children}
    </span>
  );
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
  layout: TreeRowLayout;
  onToggleDomain: (id: string) => void;
  onToggleFolder: (key: string) => void;
  onToggleLeaf: (key: string) => void;
  onOpen: (hit: WorktreeSearchHit, intent: "focus" | "open") => void;
}) {
  if (row.kind === "domain") {
    return (
      <TreeMotionRow
        layout={layout}
        depth={row.depth}
        paddingLeftPx={getTreeRowPaddingLeft(row.depth)}
        className="cursor-pointer text-xs font-medium text-ctp-text hover:bg-ctp-surface0/50"
        aria-expanded={row.expanded}
        tabIndex={0}
        onClick={() => onToggleDomain(row.key)}
        onKeyDown={activateOnEnterSpace(() => onToggleDomain(row.key))}
      >
        <DisclosureChevron expanded={row.expanded} />
        <span className={row.iconClass} />
        <span className="truncate">{row.title}</span>
      </TreeMotionRow>
    );
  }

  if (row.kind === "folder") {
    return (
      <TreeMotionRow
        layout={layout}
        depth={row.depth}
        paddingLeftPx={getTreeRowPaddingLeft(row.depth)}
        className="cursor-pointer text-xs text-ctp-subtext1 hover:bg-ctp-surface0/50"
        aria-expanded={row.expanded}
        tabIndex={0}
        onClick={() => onToggleFolder(row.key)}
        onKeyDown={activateOnEnterSpace(() => onToggleFolder(row.key))}
      >
        <DisclosureChevron expanded={row.expanded} />
        <span className={contentFolderIconClass(row.expanded)} />
        <span className="truncate">{row.segment}</span>
        <span className={searchResultCountPillClass}>{row.childCount}</span>
      </TreeMotionRow>
    );
  }

  if (row.kind === "match") {
    return (
      <TreeMotionRow
        layout={layout}
        depth={row.leafDepth}
        paddingLeftPx={searchTreeMatchPaddingLeft(row.leafDepth)}
        className="cursor-pointer text-2xs text-ctp-subtext1 hover:bg-ctp-surface0/50"
        tabIndex={0}
        onClick={() => onOpen(row.hit, "focus")}
        onDoubleClick={() => onOpen(row.hit, "open")}
        onKeyDown={activateOnEnterSpace(() => onOpen(row.hit, "focus"))}
      >
        <span className="icon-[codicon--list-flat] shrink-0 text-sm text-ctp-overlay0" />
        <span className="truncate font-mono text-ctp-text">
          <span className="mr-1 text-ctp-overlay0">{row.hit.line}:</span>
          <SearchHighlightText>{row.hit.snippet}</SearchHighlightText>
        </span>
      </TreeMotionRow>
    );
  }

  const leaf = row.leaf;
  const primaryHit = leaf.hits[0];

  const openPrimary = (intent: "focus" | "open") => {
    if (primaryHit !== undefined) {
      onOpen(primaryHit, intent);
    }
  };

  const onActivate = () => {
    if (row.showMatches) {
      onToggleLeaf(row.key);
      return;
    }
    if (primaryHit !== undefined) {
      openPrimary("focus");
    }
  };

  return (
    <TreeMotionRow
      layout={layout}
      depth={row.depth}
      paddingLeftPx={getTreeRowPaddingLeft(row.depth)}
      className={cn("text-xs text-ctp-subtext1", "cursor-pointer hover:bg-ctp-surface0/50")}
      aria-expanded={row.showMatches ? row.expanded : undefined}
      tabIndex={0}
      onClick={onActivate}
      onDoubleClick={() => openPrimary("open")}
      onKeyDown={activateOnEnterSpace(onActivate)}
    >
      {row.showMatches ? (
        <DisclosureChevron expanded={row.expanded} />
      ) : (
        <span className={treeRowDisclosureSpacerClass} />
      )}
      <span className={contentEntityIconClass(leaf.entityKind)} />
      <span className="truncate">{leaf.name}</span>
      {row.showMatches ? (
        <span className={searchResultCountPillClass}>{leaf.hits.length}</span>
      ) : null}
    </TreeMotionRow>
  );
}

export function SearchResultTree({
  status,
  errorContent,
  roots,
  highlightQuery,
  onOpenHit,
}: {
  status: TreeBodyStatus;
  errorContent?: ReactNode;
  roots: SearchResultDomainRoot[];
  highlightQuery: string;
  onOpenHit: (hit: WorktreeSearchHit, intent: "focus" | "open") => void;
}) {
  const highlightContainerRef = useRef<HTMLDivElement>(null);

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

  const highlightLayoutRevision = useMemo(
    () => flatRows.map((row) => row.key).join("\u0000"),
    [flatRows],
  );
  useSearchResultHighlights(highlightContainerRef, highlightQuery, highlightLayoutRevision);

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
    <div ref={highlightContainerRef} className="py-1">
      <TreeBody<SearchResultFlatRow>
        status={status}
        items={flatRows}
        isEmpty={flatRows.length === 0}
        getItemKey={getItemKey}
        errorContent={errorContent}
        className="w-full"
        rowHeight={TREE_ROW_HEIGHT_PX}
        renderRow={({ item: row, layout }) => (
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
  );
}
