import { ScopeProvider } from "bunshi/react";
import { nullthrow } from "foxact/nullthrow";
import { createContext, Suspense, use, useContext, useMemo, useState, type ReactNode } from "react";

import { useProjectContext } from "../state/molecules";
import { branchNameScope, DEFAULT_BRANCH_NAME } from "./branch-scopes";

type BranchScopeContextValue = {
  setActiveBranchName: (name: string) => void;
};

const BranchScopeContext = createContext<BranchScopeContextValue | null>(null);

function BranchScopeProviderInner({ children }: { children: ReactNode }) {
  const project = useProjectContext();
  const head = use(Promise.resolve(project.handle.head));
  const [branchName, setBranchName] = useState(() => head.name ?? DEFAULT_BRANCH_NAME);
  const contextValue = useMemo(
    (): BranchScopeContextValue => ({
      setActiveBranchName: setBranchName,
    }),
    [],
  );

  return (
    <BranchScopeContext.Provider value={contextValue}>
      <ScopeProvider scope={branchNameScope} value={branchName}>
        {children}
      </ScopeProvider>
    </BranchScopeContext.Provider>
  );
}

export function BranchScopeProvider({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center p-6">
          <p className="text-sm text-ctp-subtext0">加载分支…</p>
        </div>
      }
    >
      <BranchScopeProviderInner>{children}</BranchScopeProviderInner>
    </Suspense>
  );
}

export function useSetActiveBranchName(): (name: string) => void {
  return nullthrow(useContext(BranchScopeContext)).setActiveBranchName;
}
