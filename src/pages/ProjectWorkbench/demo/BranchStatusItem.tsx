import { useAtomValue, useSetAtom } from "jotai";

import { StatusBarItemButton } from "@/components/workbench";

import { branchSwitcherOpenAtom, useBranchPickerSnapshot } from "./branch-data";

const branchFallbackLabel = "无分支";

export function BranchStatusItem() {
  const snapshot = useBranchPickerSnapshot();
  const switcherOpen = useAtomValue(branchSwitcherOpenAtom);
  const setSwitcherOpen = useSetAtom(branchSwitcherOpenAtom);
  const label = snapshot.data?.headName ?? branchFallbackLabel;

  return (
    <StatusBarItemButton
      icon="icon-[codicon--source-control]"
      aria-haspopup="dialog"
      aria-expanded={switcherOpen}
      onClick={() => {
        setSwitcherOpen(true);
      }}
    >
      {label}
    </StatusBarItemButton>
  );
}
