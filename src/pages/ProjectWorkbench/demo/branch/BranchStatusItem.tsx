import { useAtomValue } from "jotai";

import { StatusBarItemButton } from "@/components/workbench";
import { quickPickOpenAtom } from "@/lib/quick-pick";

import { useEffectiveHeadName } from "./branch-data";
import { useBranchQuickPick } from "./branch-quick-pick";

const branchFallbackLabel = "无分支";

export function BranchStatusItem() {
  const headName = useEffectiveHeadName();
  const quickPickOpen = useAtomValue(quickPickOpenAtom);
  const openBranchQuickPick = useBranchQuickPick();
  const label = headName ?? branchFallbackLabel;

  return (
    <StatusBarItemButton
      icon="icon-[codicon--source-control]"
      aria-haspopup="dialog"
      aria-expanded={quickPickOpen}
      onClick={() => {
        void openBranchQuickPick();
      }}
    >
      {label}
    </StatusBarItemButton>
  );
}
