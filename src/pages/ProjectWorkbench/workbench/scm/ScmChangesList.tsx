import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import { DisclosureChevron } from "#app/components/DisclosureChevron";
import { cn } from "#app/lib/cn";
import {
  contentDomainIconClass,
  contentFolderIconClass,
} from "#app/pages/ProjectWorkbench/workbench/tree/content-tree-icons";
import { FlatTreeList } from "#app/pages/ProjectWorkbench/workbench/tree/FlatTreeList";
import type { TreeRowLayout } from "#app/pages/ProjectWorkbench/workbench/tree/tree-row-layout";
import {
  TREE_ROW_HEIGHT_PX,
  getTreeRowPaddingLeft,
  treeRowDisclosureSpacerClass,
} from "#app/pages/ProjectWorkbench/workbench/tree/tree-row-motion";
import { TreeMotionRow } from "#app/pages/ProjectWorkbench/workbench/tree/TreeMotionRow";
import type { Change } from "#shared/rpc/worktree-changes-rpc";

import {
  buildScmChangeTree,
  collectScmTreeFolderKeys,
  flattenScmChangeTree,
  type ScmChangeDomainRoot,
  type ScmChangeFlatRow,
  type ScmChangeTreeFolderNode,
} from "./scm-change-tree-projector";
import { ScmDiffItemRow } from "./ScmDiffItemRow";
import { ScmDomainRow } from "./ScmDomainRow";
const scmFolderRowClass = cn("cursor-pointer text-xs text-ctp-subtext1 hover:bg-ctp-surface0/50");
const scmFolderCountClass = cn(
  "ml-auto shrink-0 bg-ctp-surface0 px-1 py-px font-mono text-[10px] text-ctp-subtext0",
);

function activateOnEnterSpace(onActivate: () => void) {
  return (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onActivate();
    }
  };
}

function buildScmChangeRoots(
  manuscriptChanges: Change[],
  resourceChanges: Change[],
): ScmChangeDomainRoot[] {
  const roots: ScmChangeDomainRoot[] = [
    {
      id: "manuscript",
      title: "正文变更",
      iconClass: contentDomainIconClass("manuscript"),
      nodes: buildScmChangeTree(manuscriptChanges),
    },
    {
      id: "resource",
      title: "资源变更",
      iconClass: contentDomainIconClass("resource"),
      nodes: buildScmChangeTree(resourceChanges),
    },
  ];
  return roots.filter((root) => root.nodes.length > 0);
}

function folderIconClass(node: ScmChangeTreeFolderNode, expanded: boolean): string {
  const showOpened = expanded || node.children.length > 0;
  return contentFolderIconClass(showOpened);
}

function ScmFolderRow({
  row,
  layout,
  onToggle,
  onRevert,
}: {
  row: Extract<ScmChangeFlatRow, { kind: "folder" }>;
  layout: TreeRowLayout;
  onToggle: (key: string) => void;
  onRevert: (changeId: string) => void;
}) {
  const hasChildren = row.childCount > 0;
  const toggle = () => {
    if (hasChildren) {
      onToggle(row.key);
    }
  };

  if (row.inlineChange !== null) {
    return (
      <ScmDiffItemRow
        item={row.inlineChange}
        depth={row.depth}
        layout={layout}
        label={row.node.segment}
        disclosure={
          hasChildren ? (
            <DisclosureChevron expanded={row.expanded} />
          ) : (
            <span className={treeRowDisclosureSpacerClass} />
          )
        }
        iconClassName={folderIconClass(row.node, row.expanded)}
        className={hasChildren ? cn("cursor-pointer") : undefined}
        ariaExpanded={hasChildren ? row.expanded : undefined}
        onClick={hasChildren ? toggle : undefined}
        onKeyDown={hasChildren ? activateOnEnterSpace(toggle) : undefined}
        onRevert={onRevert}
      />
    );
  }

  return (
    <TreeMotionRow
      layout={layout}
      depth={row.depth}
      paddingLeftPx={getTreeRowPaddingLeft(row.depth)}
      className={scmFolderRowClass}
      aria-expanded={hasChildren ? row.expanded : undefined}
      tabIndex={0}
      onClick={hasChildren ? toggle : undefined}
      onKeyDown={hasChildren ? activateOnEnterSpace(toggle) : undefined}
    >
      {hasChildren ? (
        <DisclosureChevron expanded={row.expanded} />
      ) : (
        <span className={treeRowDisclosureSpacerClass} />
      )}
      <span className={folderIconClass(row.node, row.expanded)} />
      <span className="truncate">{row.node.segment}</span>
      <span className={scmFolderCountClass}>{row.childCount}</span>
    </TreeMotionRow>
  );
}

export function ScmChangesList({
  manuscriptChanges,
  resourceChanges,
  onRevert,
}: {
  manuscriptChanges: Change[];
  resourceChanges: Change[];
  onRevert: (changeId: string) => void;
}) {
  const roots = useMemo(
    () => buildScmChangeRoots(manuscriptChanges, resourceChanges),
    [manuscriptChanges, resourceChanges],
  );
  const domainIds = useMemo(() => roots.map((root) => root.id), [roots]);
  const folderKeys = useMemo(() => collectScmTreeFolderKeys(roots), [roots]);
  const [expandedDomainIds, setExpandedDomainIds] = useState<Set<string>>(() => new Set(domainIds));
  const [expandedFolderKeys, setExpandedFolderKeys] = useState<Set<string>>(
    () => new Set(folderKeys),
  );
  const previousDomainIdsRef = useRef<Set<string>>(new Set(domainIds));
  const previousFolderKeysRef = useRef<Set<string>>(new Set(folderKeys));

  useEffect(() => {
    setExpandedDomainIds((current) => {
      const next = new Set<string>();
      const previousDomainIds = previousDomainIdsRef.current;
      for (const domainId of domainIds) {
        if (current.has(domainId) || !previousDomainIds.has(domainId)) {
          next.add(domainId);
        }
      }
      previousDomainIdsRef.current = new Set(domainIds);
      return next;
    });
  }, [domainIds]);

  useEffect(() => {
    setExpandedFolderKeys((current) => {
      const next = new Set<string>();
      const previousFolderKeys = previousFolderKeysRef.current;
      for (const folderKey of folderKeys) {
        if (current.has(folderKey) || !previousFolderKeys.has(folderKey)) {
          next.add(folderKey);
        }
      }
      previousFolderKeysRef.current = new Set(folderKeys);
      return next;
    });
  }, [folderKeys]);

  const flatRows = useMemo(
    () => flattenScmChangeTree(roots, expandedDomainIds, expandedFolderKeys),
    [roots, expandedDomainIds, expandedFolderKeys],
  );
  const onToggleDomain = useCallback((domainId: string) => {
    setExpandedDomainIds((current) => {
      const next = new Set(current);
      if (next.has(domainId)) {
        next.delete(domainId);
      } else {
        next.add(domainId);
      }
      return next;
    });
  }, []);
  const onToggleFolder = useCallback((folderKey: string) => {
    setExpandedFolderKeys((current) => {
      const next = new Set(current);
      if (next.has(folderKey)) {
        next.delete(folderKey);
      } else {
        next.add(folderKey);
      }
      return next;
    });
  }, []);
  const getItemKey = useCallback((row: ScmChangeFlatRow) => row.key, []);

  return (
    <div className="py-1">
      <FlatTreeList
        items={flatRows}
        getItemKey={getItemKey}
        rowHeight={TREE_ROW_HEIGHT_PX}
        className="w-full"
        renderRow={(row, _index, layout) =>
          row.kind === "domain" ? (
            <ScmDomainRow
              title={row.title}
              iconClass={row.iconClass}
              expanded={row.expanded}
              childCount={row.childCount}
              layout={layout}
              onToggle={() => onToggleDomain(row.key)}
            />
          ) : row.kind === "folder" ? (
            <ScmFolderRow row={row} layout={layout} onToggle={onToggleFolder} onRevert={onRevert} />
          ) : (
            <ScmDiffItemRow item={row.item} depth={row.depth} layout={layout} onRevert={onRevert} />
          )
        }
      />
    </div>
  );
}
