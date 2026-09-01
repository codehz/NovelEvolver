import { activateOnEnterSpace } from "#app/features/project-workbench/lib/activate-on-enter-space";
import type { TreeRowLayout } from "#app/features/project-workbench/tree/tree-row-layout";
import { getTreeRowPaddingLeft } from "#app/features/project-workbench/tree/tree-row-motion";
import { TreeMotionRow } from "#app/features/project-workbench/tree/TreeMotionRow";
import { cn } from "#app/shared/lib/ui/cn";
import { DisclosureChevron } from "#app/shared/ui";

const changeGroupCountClass = cn(
  "ml-auto shrink-0 bg-ctp-surface0 px-1 py-px font-mono text-[10px] text-ctp-subtext0",
);
const changeGroupRowClass = cn(
  "cursor-pointer text-xs font-medium text-ctp-text hover:bg-ctp-surface0/55",
);

type ChangesDomainRowProps = {
  title: string;
  iconClass: string;
  expanded: boolean;
  childCount: number;
  depth?: number;
  layout: TreeRowLayout;
  onToggle: () => void;
};

export function ChangesDomainRow({
  title,
  iconClass,
  expanded,
  childCount,
  depth = 0,
  layout,
  onToggle,
}: ChangesDomainRowProps) {
  return (
    <TreeMotionRow
      layout={layout}
      depth={depth}
      paddingLeftPx={getTreeRowPaddingLeft(depth)}
      className={changeGroupRowClass}
      aria-expanded={expanded}
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={activateOnEnterSpace(onToggle)}
    >
      <DisclosureChevron expanded={expanded} />
      <span className={iconClass} />
      <span className="truncate">{title}</span>
      <span className={changeGroupCountClass}>{childCount}</span>
    </TreeMotionRow>
  );
}
