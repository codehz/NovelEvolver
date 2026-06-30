import { molecule, use, useMolecule } from "bunshi/react";
import { nullthrow } from "foxact/nullthrow";

import { StatusBarItemButton } from "@/components/workbench";
import { createAsyncLoader, useAsyncLoader } from "@/lib/async-loader";

import { projectScope } from "./molecules";

const branchFallbackLabel = "无分支";

const headNameMol = molecule(() => {
  const project = nullthrow(use(projectScope));
  return createAsyncLoader(() => project.handle.head.name);
});

export function BranchStatusItem() {
  const headName = useAsyncLoader(useMolecule(headNameMol));
  return (
    <StatusBarItemButton
      icon="icon-[codicon--source-control]"
      onClick={() => {
        void headName.refresh();
      }}
    >
      {headName.data ?? branchFallbackLabel}
    </StatusBarItemButton>
  );
}
