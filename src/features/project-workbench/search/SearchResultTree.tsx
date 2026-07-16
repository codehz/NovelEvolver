import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { cn } from "#app/shared/lib/ui/cn";
import {
  controlFocusVisibleClass,
  iconButtonHoverClass,
} from "#app/shared/lib/ui/interaction-chrome";
import { AppTooltip, Button, DisclosureChevron } from "#app/shared/ui";
import type { WorktreeSearchHit } from "#shared/rpc/worktree/index";
import { activateOnEnterSpace } from "#workbench/lib/activate-on-enter-space";
import { contentEntityIconClass, contentFolderIconClass } from "#workbench/tree/content-tree-icons";
import type { TreeRowLayout } from "#workbench/tree/tree-row-layout";
import {
  getTreeRowPaddingLeft,
  TREE_ROW_CONTENT_GAP_PX,
  TREE_ROW_DISCLOSURE_WIDTH_PX,
  TREE_ROW_HEIGHT_PX,
  treeRowDisclosureSpacerClass,
} from "#workbench/tree/tree-row-motion";
import { TreeBody, type TreeBodyStatus } from "#workbench/tree/TreeBody";
import { TreeMotionRow } from "#workbench/tree/TreeMotionRow";

import {
  collectSearchTreeFolderKeys,
  collectSearchTreeLeafKeys,
  flattenSearchResultTree,
  type SearchResultDomainRoot,
  type SearchResultFlatRow,
} from "./search-result-tree-projector";
import { buildSearchSnippetParts } from "./search-snippet-parts";

export type { SearchResultDomainRoot };

function searchTreeMatchPaddingLeft(leafDepth: number): number {
  return getTreeRowPaddingLeft(leafDepth) + TREE_ROW_DISCLOSURE_WIDTH_PX + TREE_ROW_CONTENT_GAP_PX;
}

const searchResultCountPillClass = cn(
  "ml-auto shrink-0 rounded-full bg-ctp-surface0 px-1 py-px font-mono text-[10px] text-ctp-subtext0",
);

const searchRowActionButtonClass = cn(
  "flex size-5 shrink-0 items-center justify-center rounded-sm text-ctp-overlay0",
  "opacity-0 group-focus-within/search-row:opacity-100 group-hover/search-row:opacity-100",
  "data-disabled:opacity-40",
  iconButtonHoverClass,
  controlFocusVisibleClass,
);

const searchMatchMarkClass = cn("rounded-sm bg-ctp-yellow/38 text-inherit");

const searchMatchOldClass = cn("rounded-sm bg-ctp-red/15 text-ctp-red line-through");

const searchMatchNewClass = cn("rounded-sm bg-ctp-green/20 text-ctp-green");

type SearchSnippetViewProps = {
  hit: WorktreeSearchHit;
  replacePreviewText?: string;
  showReplacePreview?: boolean;
};

function SearchSnippetView({
  hit,
  replacePreviewText = "",
  showReplacePreview = false,
}: SearchSnippetViewProps) {
  const parts = buildSearchSnippetParts({
    snippetBefore: hit.snippetBefore,
    matchText: hit.matchText,
    snippetAfter: hit.snippetAfter,
    showReplacePreview,
    replacement: replacePreviewText,
  });

  return (
    <>
      {parts.map((part, index) => {
        if (part.kind === "text") {
          return <span key={index}>{part.text}</span>;
        }
        if (part.kind === "match") {
          return (
            <mark key={index} className={searchMatchMarkClass}>
              {part.text}
            </mark>
          );
        }
        if (part.kind === "match-old") {
          return (
            <span key={index} className={searchMatchOldClass}>
              {part.text}
            </span>
          );
        }
        return (
          <span key={index} className={searchMatchNewClass}>
            {part.text}
          </span>
        );
      })}
    </>
  );
}

function SearchFlatRowView({
  row,
  layout,
  replaceEnabled,
  replacePreviewText,
  showReplacePreview,
  onToggleDomain,
  onToggleFolder,
  onToggleLeaf,
  onOpen,
  onReplaceInFile,
  onReplaceOccurrence,
}: {
  row: SearchResultFlatRow;
  layout: TreeRowLayout;
  replaceEnabled: boolean;
  replacePreviewText: string;
  showReplacePreview: boolean;
  onToggleDomain: (id: string) => void;
  onToggleFolder: (key: string) => void;
  onToggleLeaf: (key: string) => void;
  onOpen: (hit: WorktreeSearchHit, intent: "focus" | "open") => void;
  onReplaceInFile: (hit: WorktreeSearchHit) => void;
  onReplaceOccurrence: (hit: WorktreeSearchHit) => void;
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
        className="group/search-row cursor-pointer text-2xs text-ctp-subtext1 hover:bg-ctp-surface0/50"
        tabIndex={0}
        onClick={() => onOpen(row.hit, "focus")}
        onDoubleClick={() => onOpen(row.hit, "open")}
        onKeyDown={activateOnEnterSpace(() => onOpen(row.hit, "focus"))}
      >
        <span className="icon-[codicon--list-flat] shrink-0 text-sm text-ctp-overlay0" />
        <span className="min-w-0 flex-1 truncate font-mono text-ctp-text">
          <span className="mr-1 text-ctp-overlay0">{row.hit.line}:</span>
          <SearchSnippetView
            hit={row.hit}
            replacePreviewText={replacePreviewText}
            showReplacePreview={showReplacePreview}
          />
        </span>
        <AppTooltip label="替换此处" side="left">
          <Button
            variant="ghost"
            size="icon-sm"
            className={searchRowActionButtonClass}
            aria-label="替换此处"
            disabled={!replaceEnabled}
            onClick={(event) => {
              event.stopPropagation();
              onReplaceOccurrence(row.hit);
            }}
          >
            <span className="icon-[codicon--replace] text-sm" />
          </Button>
        </AppTooltip>
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
      className={cn(
        "group/search-row text-xs text-ctp-subtext1",
        "cursor-pointer hover:bg-ctp-surface0/50",
      )}
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
      <span className="min-w-0 flex-1 truncate">{leaf.name}</span>
      {row.showMatches ? (
        <span className={searchResultCountPillClass}>{leaf.hits.length}</span>
      ) : null}
      {primaryHit !== undefined ? (
        <AppTooltip label="在此文件中全部替换" side="left">
          <Button
            variant="ghost"
            size="icon-sm"
            className={searchRowActionButtonClass}
            aria-label="在此文件中全部替换"
            disabled={!replaceEnabled}
            onClick={(event) => {
              event.stopPropagation();
              onReplaceInFile(primaryHit);
            }}
          >
            <span className="icon-[codicon--replace-all] text-sm" />
          </Button>
        </AppTooltip>
      ) : null}
    </TreeMotionRow>
  );
}

type SearchResultTreeProps = {
  status: TreeBodyStatus;
  errorContent?: ReactNode;
  roots: SearchResultDomainRoot[];
  replacePreviewText?: string;
  showReplacePreview?: boolean;
  replaceEnabled?: boolean;
  onOpenHit: (hit: WorktreeSearchHit, intent: "focus" | "open") => void;
  onReplaceInFile?: (hit: WorktreeSearchHit) => void;
  onReplaceOccurrence?: (hit: WorktreeSearchHit) => void;
};

export function SearchResultTree({
  status,
  errorContent,
  roots,
  replacePreviewText = "",
  showReplacePreview = false,
  replaceEnabled = false,
  onOpenHit,
  onReplaceInFile,
  onReplaceOccurrence,
}: SearchResultTreeProps) {
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

  const handleReplaceInFile = useCallback(
    (hit: WorktreeSearchHit) => {
      onReplaceInFile?.(hit);
    },
    [onReplaceInFile],
  );

  const handleReplaceOccurrence = useCallback(
    (hit: WorktreeSearchHit) => {
      onReplaceOccurrence?.(hit);
    },
    [onReplaceOccurrence],
  );

  const getItemKey = useCallback((row: SearchResultFlatRow) => row.key, []);

  return (
    <div className="py-1">
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
            replaceEnabled={replaceEnabled}
            replacePreviewText={replacePreviewText}
            showReplacePreview={showReplacePreview}
            onToggleDomain={onToggleDomain}
            onToggleFolder={onToggleFolder}
            onToggleLeaf={onToggleLeaf}
            onOpen={onOpenHit}
            onReplaceInFile={handleReplaceInFile}
            onReplaceOccurrence={handleReplaceOccurrence}
          />
        )}
      />
    </div>
  );
}
