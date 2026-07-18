import { ScopeProvider, useMolecule } from "bunshi/react";
import { useAtom } from "jotai";
import type { ReactNode } from "react";

import { activeBranchAtomMolecule, branchNameScope } from "./branch-scope";
import { useWorktreeChangesFeedSync } from "./changes-feed/use-worktree-changes-feed-sync";

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
