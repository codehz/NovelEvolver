import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { cn } from "#app/shared/lib/ui/cn";
import { rowHoverClass } from "#app/shared/lib/ui/interaction-chrome";
import { DisclosureChevron } from "#app/shared/ui";
import type { Change } from "#shared/rpc/worktree/index";
import {
  buildChangeTree,
  collectChangeTreeFolderKeys,
  flattenChangeTree,
  type ChangeDomainRoot,
  type ChangeFlatRow,
  type ChangeTreeFolderNode,
} from "#workbench/changes/change-tree-projector";
import { ChangesDomainRow } from "#workbench/changes/ChangesDomainRow";
import { ChangeStatsBadge } from "#workbench/changes/ChangeStatsBadge";
import { activateOnEnterSpace } from "#workbench/lib/activate-on-enter-space";
import {
  contentDomainIconClass,
  contentEntityIconClass,
  contentFolderIconClass,
} from "#workbench/tree/content-tree-icons";
import { FlatTreeList } from "#workbench/tree/FlatTreeList";
import type { TreeRowLayout } from "#workbench/tree/tree-row-layout";
import {
  TREE_ROW_HEIGHT_PX,
  getTreeRowPaddingLeft,
  treeRowDisclosureSpacerClass,
} from "#workbench/tree/tree-row-motion";
import { TreeMotionRow } from "#workbench/tree/TreeMotionRow";

const changeFolderRowClass = cn(
  "cursor-pointer text-xs text-ctp-subtext1 hover:bg-ctp-surface0/50",
);
const changeFolderCountClass = cn(
  "ml-auto shrink-0 bg-ctp-surface0 px-1 py-px font-mono text-[10px] text-ctp-subtext0",
);
const changeRowClass = cn("group cursor-default text-xs text-ctp-subtext1", rowHoverClass);
const changeMetaClass = cn("ml-auto flex shrink-0 items-center gap-1");

function changeKindIconClass(kind: Change["kind"]): string {
  return cn(
    kind === "create" && "icon-[codicon--diff-added] text-ctp-green",
    kind === "delete" && "icon-[codicon--diff-removed] text-ctp-red",
    kind === "content" && "icon-[codicon--diff-modified] text-ctp-yellow",
    kind === "rename" && "icon-[codicon--edit] text-ctp-yellow",
    kind === "move" && "icon-[codicon--diff-modified] text-ctp-yellow",
    kind === "reorder" && "icon-[codicon--list-flat] text-ctp-subtext0",
  );
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

function CommitChangeItemRow({
  item,
  depth,
  layout,
  label,
  disclosure,
  iconClassName,
  className,
  ariaExpanded,
  onClick,
  onKeyDown,
}: {
  item: Change;
  depth: number;
  layout: TreeRowLayout;
  label?: string;
  disclosure?: ReactNode;
  iconClassName?: string;
  className?: string;
  ariaExpanded?: boolean;
  onClick?: () => void;
  onKeyDown?: (event: KeyboardEvent) => void;
}) {
  return (
    <TreeMotionRow
      layout={layout}
      depth={depth}
      className={cn(changeRowClass, className)}
      aria-expanded={ariaExpanded}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      {disclosure ?? <span className={treeRowDisclosureSpacerClass} />}
      <span className={iconClassName ?? contentEntityIconClass(item.entityKind)} />
      <span className="truncate">{label ?? item.label}</span>
      {item.kind === "reorder" ? (
        <span className="shrink-0 text-[10px] text-ctp-overlay0">顺序</span>
      ) : null}
      <span className={changeMetaClass}>
        {item.stats !== undefined ? (
          <ChangeStatsBadge added={item.stats.added} removed={item.stats.removed} />
        ) : null}
        <span className={cn(changeKindIconClass(item.kind), "shrink-0 text-sm")} />
      </span>
    </TreeMotionRow>
  );
}

function CommitChangeFolderRow({
  row,
  layout,
  onToggle,
  onOpenChange,
}: {
  row: Extract<ChangeFlatRow, { kind: "folder" }>;
  layout: TreeRowLayout;
  onToggle: (key: string) => void;
  onOpenChange: (change: Change) => void;
}) {
  const hasChildren = row.childCount > 0;
  const toggle = () => {
    if (hasChildren) {
      onToggle(row.key);
    }
  };

  if (row.inlineChange !== null) {
    const previewable = isPreviewableChange(row.inlineChange);
    return (
      <CommitChangeItemRow
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
        className={hasChildren || previewable ? cn("cursor-pointer") : undefined}
        ariaExpanded={hasChildren ? row.expanded : undefined}
        onClick={
          hasChildren ? toggle : previewable ? () => onOpenChange(row.inlineChange!) : undefined
        }
        onKeyDown={
          hasChildren
            ? activateOnEnterSpace(toggle)
            : previewable
              ? activateOnEnterSpace(() => onOpenChange(row.inlineChange!))
              : undefined
        }
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

type CommitChangesTreeProps = {
  manuscriptChanges: Change[];
  resourceChanges: Change[];
  onOpenChange: (change: Change) => void;
};

export function CommitChangesTree({
  manuscriptChanges,
  resourceChanges,
  onOpenChange,
}: CommitChangesTreeProps) {
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

  if (roots.length === 0) {
    return <div className="p-1 text-[10px] text-ctp-overlay0">此提交无文件变更。</div>;
  }

  return (
    <div className="py-0.5">
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
            <CommitChangeFolderRow
              row={row}
              layout={layout}
              onToggle={onToggleFolder}
              onOpenChange={onOpenChange}
            />
          ) : (
            <CommitChangeItemRow
              item={row.item}
              depth={row.depth}
              layout={layout}
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
