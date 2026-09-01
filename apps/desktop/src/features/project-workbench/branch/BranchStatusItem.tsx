import { useAtomValue } from "jotai";

import { StatusBarItemButton } from "#app/features/project-workbench/chrome";
import { useActiveBranchName } from "#app/features/project-workbench/session/branch-scope";
import { quickPickOpenAtom } from "#app/shared/lib/quick-pick";

import { useBranchQuickPick } from "./branch-quick-pick";

export function BranchStatusItem() {
  const branchName = useActiveBranchName();
  const quickPickOpen = useAtomValue(quickPickOpenAtom);
  const openBranchQuickPick = useBranchQuickPick();

  return (
    <StatusBarItemButton
      icon="icon-[codicon--source-control]"
      aria-haspopup="dialog"
      aria-expanded={quickPickOpen}
      onClick={() => {
        void openBranchQuickPick();
      }}
    >
      {branchName}
    </StatusBarItemButton>
  );
}
