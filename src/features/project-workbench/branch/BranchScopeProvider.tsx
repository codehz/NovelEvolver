import { ScopeProvider, useMolecule } from "bunshi/react";
import { useAtom } from "jotai";
import type { ReactNode } from "react";

import { useWorktreeChangesFeedSync } from "#workbench/worktree/use-worktree-changes-feed-sync";

import { activeBranchAtomMolecule, branchNameScope } from "./branch-scopes";

type BranchScopeProviderProps = {
  children: ReactNode;
};

function BranchScopeFeedSync({ children }: BranchScopeProviderProps) {
  useWorktreeChangesFeedSync();
  return children;
}

export function BranchScopeProvider({ children }: BranchScopeProviderProps) {
  const [branchName] = useAtom(useMolecule(activeBranchAtomMolecule));

  return (
    <ScopeProvider scope={branchNameScope} value={branchName}>
      <BranchScopeFeedSync>{children}</BranchScopeFeedSync>
    </ScopeProvider>
  );
}
