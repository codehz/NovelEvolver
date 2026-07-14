import { ScopeProvider, useMolecule } from "bunshi/react";
import { useAtom } from "jotai";
import type { ReactNode } from "react";

import { activeBranchAtomMolecule, branchNameScope } from "./branch-scopes";

type BranchScopeProviderProps = {
  children: ReactNode;
};

export function BranchScopeProvider({ children }: BranchScopeProviderProps) {
  const [branchName] = useAtom(useMolecule(activeBranchAtomMolecule));

  return (
    <ScopeProvider scope={branchNameScope} value={branchName}>
      {children}
    </ScopeProvider>
  );
}
