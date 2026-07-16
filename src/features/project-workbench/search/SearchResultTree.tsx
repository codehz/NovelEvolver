import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, Ref } from "react";

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

const searchMatchMarkClass = cn("bg-ctp-blue/38 text-inherit");

const searchMatchOldClass = cn("bg-ctp-red/15 text-ctp-red line-through");

const searchMatchNewClass = cn("bg-ctp-green/20 text-ctp-green");

/** Soft edge fade width; also used as the match-centering content inset when overflowing. */
const SNIPPET_EDGE_FADE_PX = 12;

/**
 * Horizontal snippet window: clip overflow, no scrollbar, rows share the same text origin
 * (no negative-margin gutter). Edge masks are toggled via `data-edge` from scroll position
 * so the start of a line is not faded when `scrollLeft === 0`.
 *
 * Note: CSS `scroll-state` container queries cannot style the query container itself, and
 * `mix-blend-mode: destination-out` is unavailable — so masks stay on this host and
 * `data-edge` is synced from scroll/resize instead.
 */
const searchSnippetViewportClass = cn(
  "min-w-0 flex-1 scrollbar-none overflow-x-auto font-mono whitespace-nowrap text-ctp-text",
  "data-[edge=right]:mask-[linear-gradient(to_right,black,black_calc(100%-0.75rem),transparent)]",
  "data-[edge=left]:mask-[linear-gradient(to_right,transparent,black_0.75rem,black)]",
  "data-[edge=both]:mask-[linear-gradient(to_right,transparent,black_0.75rem,black_calc(100%-0.75rem),transparent)]",
);

type SnippetEdgeMask = "none" | "left" | "right" | "both";

function snippetEdgeMask(host: HTMLElement): SnippetEdgeMask {
  const maxScroll = Math.max(0, host.scrollWidth - host.clientWidth);
  if (maxScroll <= 0) {
    return "none";
  }
  const atStart = host.scrollLeft <= 0.5;
  const atEnd = host.scrollLeft >= maxScroll - 0.5;
  if (!atStart && !atEnd) {
    return "both";
  }
  if (!atStart) {
    return "left";
  }
  if (!atEnd) {
    return "right";
  }
  return "none";
}

function syncSnippetEdgeMask(host: HTMLElement): void {
  const edge = snippetEdgeMask(host);
  if (edge === "none") {
    delete host.dataset.edge;
    return;
  }
  host.dataset.edge = edge;
}

/**
 * Center (or pin-start) a match element inside a horizontal overflow host.
 * Uses scrollLeft only so virtualized tree ancestors do not jump vertically.
 */
function centerMatchInSnippetHost(host: HTMLElement, match: HTMLElement): void {
  const maxScroll = Math.max(0, host.scrollWidth - host.clientWidth);
  if (maxScroll === 0) {
    host.scrollLeft = 0;
    return;
  }

  const hostRect = host.getBoundingClientRect();
  const matchRect = match.getBoundingClientRect();
  if (hostRect.width <= 0) {
    return;
  }

  // Keep the match inside the non-faded content window when edges can soft-mask.
  const contentLeft = hostRect.left + SNIPPET_EDGE_FADE_PX;
  const contentWidth = hostRect.width - SNIPPET_EDGE_FADE_PX * 2;
  if (contentWidth <= 0) {
    return;
  }

  if (matchRect.width >= contentWidth) {
    // Prefer the start of a wide match over its center.
    const next = host.scrollLeft + (matchRect.left - contentLeft);
    host.scrollLeft = Math.max(0, Math.min(maxScroll, next));
    return;
  }

  const matchCenter = matchRect.left + matchRect.width / 2;
  const contentCenter = contentLeft + contentWidth / 2;
  const next = host.scrollLeft + (matchCenter - contentCenter);
  host.scrollLeft = Math.max(0, Math.min(maxScroll, next));
}

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
  const hostRef = useRef<HTMLSpanElement>(null);
  const matchRef = useRef<HTMLElement | null>(null);
  const setMatchRef: Ref<HTMLElement> = (node) => {
    matchRef.current = node;
  };

  const parts = buildSearchSnippetParts({
    snippetBefore: hit.snippetBefore,
    matchText: hit.matchText,
    snippetAfter: hit.snippetAfter,
    showReplacePreview,
    replacement: replacePreviewText,
  });

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (host === null) {
      return;
    }

    const match = matchRef.current;
    if (match === null) {
      host.scrollLeft = 0;
    } else {
      centerMatchInSnippetHost(host, match);
    }
    syncSnippetEdgeMask(host);

    const onScroll = () => {
      syncSnippetEdgeMask(host);
    };
    host.addEventListener("scroll", onScroll, { passive: true });

    const resizeObserver = new ResizeObserver(() => {
      syncSnippetEdgeMask(host);
    });
    resizeObserver.observe(host);

    return () => {
      host.removeEventListener("scroll", onScroll);
      resizeObserver.disconnect();
    };
  }, [hit.snippetBefore, hit.matchText, hit.snippetAfter, replacePreviewText, showReplacePreview]);

  // Replace preview is consecutive match-old / match-new; wrap so the pair stays in view.
  const nodes: ReactNode[] = [];
  let replaceGroup: ReactNode[] | null = null;
  let matchRefAttached = false;

  for (let index = 0; index < parts.length; index++) {
    const part = parts[index]!;
    if (part.kind === "text") {
      nodes.push(<span key={index}>{part.text}</span>);
      continue;
    }
    if (part.kind === "match") {
      nodes.push(
        <mark
          key={index}
          ref={matchRefAttached ? undefined : setMatchRef}
          className={searchMatchMarkClass}
        >
          {part.text}
        </mark>,
      );
      matchRefAttached = true;
      continue;
    }
    if (part.kind === "match-old" || part.kind === "match-new") {
      if (replaceGroup === null) {
        replaceGroup = [];
      }
      replaceGroup.push(
        <span
          key={index}
          className={part.kind === "match-old" ? searchMatchOldClass : searchMatchNewClass}
        >
          {part.text}
        </span>,
      );
      const next = parts[index + 1];
      const moreReplace = next?.kind === "match-old" || next?.kind === "match-new";
      if (!moreReplace) {
        nodes.push(
          <span key={`replace-${index}`} ref={matchRefAttached ? undefined : setMatchRef}>
            {replaceGroup}
          </span>,
        );
        matchRefAttached = true;
        replaceGroup = null;
      }
    }
  }

  return (
    <span ref={hostRef} className={searchSnippetViewportClass}>
      {nodes}
    </span>
  );
}

function SearchFlatRowView({
  row,
  layout,
  replaceEnabled,
  replacePreviewText,
  showReplacePreview,
  showReplaceActions,
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
  showReplaceActions: boolean;
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
        <SearchSnippetView
          hit={row.hit}
          replacePreviewText={replacePreviewText}
          showReplacePreview={showReplacePreview}
        />
        {showReplaceActions ? (
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
        ) : null}
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
      {showReplaceActions && primaryHit !== undefined ? (
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
  /** When true (replace panel open), row replace actions mount and appear on hover/focus. */
  showReplaceActions?: boolean;
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
  showReplaceActions = false,
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
            showReplaceActions={showReplaceActions}
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
