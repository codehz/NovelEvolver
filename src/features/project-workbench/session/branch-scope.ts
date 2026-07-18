import { createScope, molecule, use, useMolecule } from "bunshi/react";
import { atom, useSetAtom } from "jotai";

import { projectMolecule } from "./project-scope";

export const DEFAULT_BRANCH_NAME = "main";

export const activeBranchAtomMolecule = molecule(() => {
  const project = use(projectMolecule);
  return atom(Promise.resolve(project.currentBranch.name) as Promise<string> | string);
});

/** 返回 activeBranchAtom 的 setter，用于在切换分支后更新 atom 值。 */
export function useSetActiveBranchAtom() {
  return useSetAtom(useMolecule(activeBranchAtomMolecule));
}

/** 当前工作台所操作的分支名（与仓库 HEAD 同步，由 BranchScopeProvider 与切换逻辑维护）。 */
export const branchNameScope = createScope<string>(DEFAULT_BRANCH_NAME);

const activeBranchNameMolecule = molecule(() => use(branchNameScope));

export function useActiveBranchName(): string {
  return useMolecule(activeBranchNameMolecule);
}
