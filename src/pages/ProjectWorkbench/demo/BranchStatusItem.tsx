import { useMolecule } from "bunshi/react";
import { use } from "react";
import { useQueryRequest } from "@/lib/app-query";
import { projectMolecule } from "./molecules";

const branchFallbackLabel = "无分支";

export function BranchStatusItem() {
  const project = use(useMolecule(projectMolecule));
  const branchQuery = useQueryRequest(() => project.handle.head, {
    args: [],
    deps: [project],
    errorMessage: branchFallbackLabel,
    initialData: null,
  });
  const branchLabel = branchQuery.data?.name ?? branchFallbackLabel;

  return (
    <button
      className="flex shrink-0 items-center gap-1.5 px-2.5 hover:bg-window-button-hover"
      type="button"
      onClick={() => {
        void branchQuery.refresh();
      }}
    >
      <span aria-hidden="true" className="icon-[codicon--source-control]" />
      <span>{branchLabel}</span>
    </button>
  );
}
