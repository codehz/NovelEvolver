import type { KeyboardEvent, ReactNode } from "react";

import { cn } from "#app/lib/cn";
import type { TreeRowLayout } from "#app/pages/ProjectWorkbench/workbench/tree/tree-row-layout";
import { treeRowDisclosureSpacerClass } from "#app/pages/ProjectWorkbench/workbench/tree/tree-row-motion";
import { TreeMotionRow } from "#app/pages/ProjectWorkbench/workbench/tree/TreeMotionRow";
import type { Change } from "#shared/rpc/worktree-changes-rpc";

import { contentEntityIconClass } from "../tree/content-tree-icons";
import { ChangeStatsBadge } from "./ChangeStatsBadge";

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

const changeRowClass = cn(
  "group cursor-default text-xs text-ctp-subtext1 hover:bg-ctp-surface0/50",
);
const changeMetaClass = cn("ml-auto flex shrink-0 items-center gap-1");
const changeMetaIdleClass = cn(
  "flex shrink-0 items-center gap-1 group-focus-within:hidden group-hover:hidden",
);
const changeRevertButtonClass = cn(
  "hidden size-5 shrink-0 cursor-pointer items-center justify-center text-ctp-overlay0",
  "group-focus-within:flex group-hover:flex hover:bg-ctp-surface1 hover:text-ctp-subtext1",
);

export function ChangeItemRow({
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
  onRevert,
  onOpen,
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
  onRevert: (changeId: string) => void;
  onOpen?: (change: Change) => void;
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
      onDoubleClick={onOpen ? () => onOpen(item) : undefined}
    >
      {disclosure ?? <span className={treeRowDisclosureSpacerClass} />}
      <span className={iconClassName ?? contentEntityIconClass(item.entityKind)} />
      <span className="truncate">{label ?? item.label}</span>
      {item.kind === "reorder" ? (
        <span className="shrink-0 text-[10px] text-ctp-overlay0">顺序</span>
      ) : null}
      <span className={changeMetaClass}>
        <span className={changeMetaIdleClass}>
          {item.stats !== undefined ? (
            <ChangeStatsBadge added={item.stats.added} removed={item.stats.removed} />
          ) : null}
          <span className={cn(changeKindIconClass(item.kind), "shrink-0 text-sm")} />
        </span>
        <button
          type="button"
          className={changeRevertButtonClass}
          onClick={(e) => {
            e.stopPropagation();
            onRevert(item.id);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.stopPropagation();
              onRevert(item.id);
            }
          }}
          title="还原此变更"
        >
          <span className="icon-[codicon--discard] text-sm" />
        </button>
      </span>
    </TreeMotionRow>
  );
}
