import { useAtomValue } from "jotai";

import { quickPickOpenAtom } from "#app/shared/lib/quick-pick";
import { StatusBarItemButton } from "#workbench/chrome";

import { useBranchQuickPick } from "./branch-quick-pick";
import { useActiveBranchName } from "./branch-scopes";

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
