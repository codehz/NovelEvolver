import { cn } from "#app/lib/cn";
import type { ScmChange } from "#shared/rpc/worktree-scm";

import { ScmDiffItemRow } from "./ScmDiffItemRow";

const manuscriptGroupIconClass = cn("icon-[codicon--symbol-method]");
const resourceGroupIconClass = cn("icon-[codicon--symbol-file]");

function ScmChangeGroup({
  title,
  iconClass,
  changes,
  onRevert,
}: {
  title: string;
  iconClass: string;
  changes: ScmChange[];
  onRevert: (changeId: string) => void;
}) {
  if (changes.length === 0) {
    return null;
  }

  return (
    <section>
      <div className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-ctp-mauve uppercase">
        <span className={cn(iconClass, "shrink-0 text-sm")} />
        {title}
        <span className="ml-0.5 rounded bg-ctp-surface0 px-1 py-px font-mono text-ctp-subtext0">
          {changes.length}
        </span>
      </div>
      <ul className="flex flex-col" role="tree">
        {changes.map((item) => (
          <ScmDiffItemRow key={item.id} item={item} onRevert={onRevert} />
        ))}
      </ul>
    </section>
  );
}

export function ScmChangesList({
  manuscriptChanges,
  resourceChanges,
  onRevert,
}: {
  manuscriptChanges: ScmChange[];
  resourceChanges: ScmChange[];
  onRevert: (changeId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5 py-1">
      <ScmChangeGroup
        title="正文变更"
        iconClass={manuscriptGroupIconClass}
        changes={manuscriptChanges}
        onRevert={onRevert}
      />
      <ScmChangeGroup
        title="资源变更"
        iconClass={resourceGroupIconClass}
        changes={resourceChanges}
        onRevert={onRevert}
      />
    </div>
  );
}
