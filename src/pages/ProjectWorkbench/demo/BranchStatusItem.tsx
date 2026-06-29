import { molecule, use, useMolecule } from "bunshi/react";
import { nullthrow } from "foxact/nullthrow";
import { createAsyncLoader, useAsyncLoader } from "@/lib/async-loader";
import { projectScope } from "./molecules";

const branchFallbackLabel = "无分支";

const headNameMol = molecule(() => {
  const project = nullthrow(use(projectScope));
  return createAsyncLoader(() => project.handle.head.name);
});

export function BranchStatusItem() {
  const [headName, refresh] = useAsyncLoader(useMolecule(headNameMol));
  return (
    <button
      className="flex shrink-0 items-center gap-1.5 px-2.5 hover:bg-window-button-hover"
      type="button"
      onClick={() => {
        refresh();
      }}
    >
      <span aria-hidden="true" className="icon-[codicon--source-control]" />
      <span>{headName.data ?? branchFallbackLabel}</span>
    </button>
  );
}
