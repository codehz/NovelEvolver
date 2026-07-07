import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

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
import { cn } from "#app/shared/lib/ui/cn";
import { DisclosureChevron } from "#app/shared/ui/DisclosureChevron";
import type { Change } from "#shared/rpc/worktree-changes-rpc";

import {
  buildChangeTree,
  collectChangeTreeFolderKeys,
  flattenChangeTree,
  type ChangeDomainRoot,
  type ChangeFlatRow,
  type ChangeTreeFolderNode,
} from "./change-tree-projector";
import { ChangeItemRow } from "./ChangeItemRow";
import { ChangesDomainRow } from "./ChangesDomainRow";
const changeFolderRowClass = cn(
  "cursor-pointer text-xs text-ctp-subtext1 hover:bg-ctp-surface0/50",
);
const changeFolderCountClass = cn(
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

function isPreviewableChange(change: Change): boolean {
  return (
    (change.kind === "create" || change.kind === "delete" || change.kind === "content") &&
    (change.entityKind === "chapter" || change.entityKind === "file")
  );
}

function buildChangeRoots(
  manuscriptChanges: Change[],
  resourceChanges: Change[],
): ChangeDomainRoot[] {
  const roots: ChangeDomainRoot[] = [
    {
      id: "manuscript",
      title: "正文变更",
      iconClass: contentDomainIconClass("manuscript"),
      nodes: buildChangeTree(manuscriptChanges),
    },
    {
      id: "resource",
      title: "资源变更",
      iconClass: contentDomainIconClass("resource"),
      nodes: buildChangeTree(resourceChanges),
    },
  ];
  return roots.filter((root) => root.nodes.length > 0);
}

function folderIconClass(node: ChangeTreeFolderNode, expanded: boolean): string {
  const showOpened = expanded || node.children.length > 0;
  return contentFolderIconClass(showOpened);
}

function ChangeFolderRow({
  row,
  layout,
  onToggle,
  onRevert,
  onOpenChange,
}: {
  row: Extract<ChangeFlatRow, { kind: "folder" }>;
  layout: TreeRowLayout;
  onToggle: (key: string) => void;
  onRevert: (changeId: string) => void;
  onOpenChange: (change: Change) => void;
}) {
  const hasChildren = row.childCount > 0;
  const toggle = () => {
    if (hasChildren) {
      onToggle(row.key);
    }
  };

  if (row.inlineChange !== null) {
    return (
      <ChangeItemRow
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
        onOpen={isPreviewableChange(row.inlineChange) ? onOpenChange : undefined}
      />
    );
  }

  return (
    <TreeMotionRow
      layout={layout}
      depth={row.depth}
      paddingLeftPx={getTreeRowPaddingLeft(row.depth)}
      className={changeFolderRowClass}
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
      <span className={changeFolderCountClass}>{row.childCount}</span>
    </TreeMotionRow>
  );
}

export function ChangesList({
  manuscriptChanges,
  resourceChanges,
  onRevert,
  onOpenChange,
}: {
  manuscriptChanges: Change[];
  resourceChanges: Change[];
  onRevert: (changeId: string) => void;
  onOpenChange: (change: Change) => void;
}) {
  const roots = useMemo(
    () => buildChangeRoots(manuscriptChanges, resourceChanges),
    [manuscriptChanges, resourceChanges],
  );
  const domainIds = useMemo(() => roots.map((root) => root.id), [roots]);
  const folderKeys = useMemo(() => collectChangeTreeFolderKeys(roots), [roots]);
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
    () => flattenChangeTree(roots, expandedDomainIds, expandedFolderKeys),
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
  const getItemKey = useCallback((row: ChangeFlatRow) => row.key, []);

  return (
    <div className="py-1">
      <FlatTreeList
        items={flatRows}
        getItemKey={getItemKey}
        rowHeight={TREE_ROW_HEIGHT_PX}
        className="w-full"
        renderRow={(row, _index, layout) =>
          row.kind === "domain" ? (
            <ChangesDomainRow
              title={row.title}
              iconClass={row.iconClass}
              expanded={row.expanded}
              childCount={row.childCount}
              layout={layout}
              onToggle={() => onToggleDomain(row.key)}
            />
          ) : row.kind === "folder" ? (
            <ChangeFolderRow
              row={row}
              layout={layout}
              onToggle={onToggleFolder}
              onRevert={onRevert}
              onOpenChange={onOpenChange}
            />
          ) : (
            <ChangeItemRow
              item={row.item}
              depth={row.depth}
              layout={layout}
              onRevert={onRevert}
              onOpen={isPreviewableChange(row.item) ? onOpenChange : undefined}
              onClick={isPreviewableChange(row.item) ? () => onOpenChange(row.item) : undefined}
              onKeyDown={
                isPreviewableChange(row.item)
                  ? activateOnEnterSpace(() => onOpenChange(row.item))
                  : undefined
              }
              className={isPreviewableChange(row.item) ? cn("cursor-pointer") : undefined}
            />
          )
        }
      />
    </div>
  );
}
