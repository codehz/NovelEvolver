import { ScopeProvider, useMolecule } from "bunshi/react";
import { nullthrow } from "foxact/nullthrow";
import { useAtom } from "jotai";
import { createContext, use, useMemo, type ReactNode } from "react";

import { activeBranchAtomMolecule, branchNameScope } from "./branch-scopes";

type BranchScopeContextValue = {
  setActiveBranchName: (name: string) => void;
};

const BranchScopeContext = createContext<BranchScopeContextValue | null>(null);

export function BranchScopeProvider({ children }: { children: ReactNode }) {
  const [branchName, setBranchName] = useAtom(useMolecule(activeBranchAtomMolecule));
  const contextValue = useMemo(
    (): BranchScopeContextValue => ({
      setActiveBranchName: setBranchName as never as (name: string) => void,
    }),
    [],
  );

  return (
    <BranchScopeContext value={contextValue}>
      <ScopeProvider scope={branchNameScope} value={branchName}>
        {children}
      </ScopeProvider>
    </BranchScopeContext>
  );
}

export function useSetActiveBranchName(): (name: string) => void {
  return nullthrow(use(BranchScopeContext)).setActiveBranchName;
}
