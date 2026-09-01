import type { Change } from "@novelevolver/domain/worktree";
import type { KeyboardEvent, ReactNode } from "react";

import { ChangeStatsBadge } from "#app/features/project-workbench/lib/ChangeStatsBadge";
import { contentEntityIconClass } from "#app/features/project-workbench/tree/content-tree-icons";
import type { TreeRowLayout } from "#app/features/project-workbench/tree/tree-row-layout";
import { treeRowDisclosureSpacerClass } from "#app/features/project-workbench/tree/tree-row-motion";
import { TreeMotionRow } from "#app/features/project-workbench/tree/TreeMotionRow";
import { cn } from "#app/shared/lib/ui/cn";
import { rowHoverClass } from "#app/shared/lib/ui/interaction-chrome";
import { Button, AppTooltip } from "#app/shared/ui";

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

const changeRowClass = cn("group cursor-default text-xs text-ctp-subtext1", rowHoverClass);
const changeMetaClass = cn("ml-auto flex shrink-0 items-center gap-1");
const changeMetaIdleClass = cn(
  "flex shrink-0 items-center gap-1 group-focus-within:hidden group-hover:hidden",
);
const changeRevertButtonClass = cn(
  "hidden size-5 shrink-0 cursor-pointer items-center justify-center text-ctp-overlay0",
  "group-focus-within:flex group-hover:flex hover:bg-ctp-surface1 hover:text-ctp-subtext1",
);

type ChangeItemRowProps = {
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
};

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
}: ChangeItemRowProps) {
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
        <AppTooltip label="还原此变更" side="left">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="还原此变更"
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
          >
            <span className="icon-[codicon--discard] text-sm" />
          </Button>
        </AppTooltip>
      </span>
    </TreeMotionRow>
  );
}
