import { createScope, molecule, use, useMolecule } from "bunshi/react";
import type { RpcPromise } from "capnweb";
import { atom, useSetAtom } from "jotai";

import type {
  ManuscriptHandle,
  ResourceLibraryHandle,
  WorktreeHandle,
} from "#shared/rpc/projects-rpc";
import type { WorktreeScmHandle } from "#shared/rpc/worktree-scm";
import type { WorktreeTreeHandle } from "#shared/rpc/worktree-tree";

import { projectMolecule } from "../state/molecules";

export const DEFAULT_BRANCH_NAME = "main";

export const activeBranchAtomMolecule = molecule(() => {
  const project = use(projectMolecule);
  return atom(Promise.resolve(project.handle.head.name) as Promise<string> | string);
});

/** 返回 activeBranchAtom 的 setter，用于在切换分支后更新 atom 值。 */
export function useSetActiveBranchAtom() {
  return useSetAtom(useMolecule(activeBranchAtomMolecule));
}

/** 当前工作台所操作的分支名（与仓库 HEAD 同步，由 BranchScopeProvider 与切换逻辑维护）。 */
export const branchNameScope = createScope<string>(DEFAULT_BRANCH_NAME);

const activeBranchNameMolecule = molecule(() => use(branchNameScope));

/** 当前分支对应的虚拟 worktree RPC 引用（随 project × branchName scope 重建）。 */
export const worktreeMolecule = molecule(() => {
  const project = use(projectMolecule);
  const branchName = use(branchNameScope);
  return project.handle.openWorktree(branchName);
});

/** 当前分支资源库根（`openWorktree(...).resources` 级联，不在此 await）。 */
export const resourceLibraryMolecule = molecule(() => use(worktreeMolecule).resources);

/** 当前分支正文根（`openWorktree(...).manuscript` 级联，不在此 await）。 */
export const manuscriptMolecule = molecule(() => use(worktreeMolecule).manuscript);

/** 当前分支 SCM 句柄（`openWorktree(...).scm` 级联，不在此 await）。 */
export const worktreeScmMolecule = molecule(() => use(worktreeMolecule).scm);

/** 当前分支树同步句柄（`openWorktree(...).tree` 级联，不在此 await）。 */
export const worktreeTreeMolecule = molecule(() => use(worktreeMolecule).tree);

export function useActiveBranchName(): string {
  return useMolecule(activeBranchNameMolecule);
}

export function useWorktree(): RpcPromise<WorktreeHandle> {
  return useMolecule(worktreeMolecule);
}

export function useResourceLibrary(): RpcPromise<ResourceLibraryHandle> {
  return useMolecule(resourceLibraryMolecule);
}

export function useManuscript(): RpcPromise<ManuscriptHandle> {
  return useMolecule(manuscriptMolecule);
}

export function useWorktreeScm(): RpcPromise<WorktreeScmHandle> {
  return useMolecule(worktreeScmMolecule);
}

export function useWorktreeTree(): RpcPromise<WorktreeTreeHandle> {
  return useMolecule(worktreeTreeMolecule);
}
