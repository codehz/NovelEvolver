import type { KeyboardEvent } from "react";

import { DisclosureChevron } from "#app/components/DisclosureChevron";
import { cn } from "#app/lib/cn";
import type { TreeRowLayout } from "#app/pages/ProjectWorkbench/workbench/tree/tree-row-layout";
import { getTreeRowPaddingLeft } from "#app/pages/ProjectWorkbench/workbench/tree/tree-row-motion";
import { TreeMotionRow } from "#app/pages/ProjectWorkbench/workbench/tree/TreeMotionRow";

function activateOnEnterSpace(onActivate: () => void) {
  return (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onActivate();
    }
  };
}

const scmGroupCountClass = cn(
  "ml-auto shrink-0 bg-ctp-surface0 px-1 py-px font-mono text-[10px] text-ctp-subtext0",
);
const scmGroupRowClass = cn(
  "cursor-pointer text-xs font-medium text-ctp-text hover:bg-ctp-surface0/50",
);

export function ScmDomainRow({
  title,
  iconClass,
  expanded,
  childCount,
  layout,
  onToggle,
}: {
  title: string;
  iconClass: string;
  expanded: boolean;
  childCount: number;
  layout: TreeRowLayout;
  onToggle: () => void;
}) {
  return (
    <TreeMotionRow
      layout={layout}
      depth={0}
      paddingLeftPx={getTreeRowPaddingLeft(0)}
      className={scmGroupRowClass}
      aria-expanded={expanded}
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={activateOnEnterSpace(onToggle)}
    >
      <DisclosureChevron expanded={expanded} />
      <span className={cn(iconClass, "shrink-0 text-sm")} />
      <span className="truncate">{title}</span>
      <span className={scmGroupCountClass}>{childCount}</span>
    </TreeMotionRow>
  );
}
